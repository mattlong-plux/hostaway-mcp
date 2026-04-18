import { hostawayRequest, isReadOnly, readOnlyError, toolResult, toolError, validateId } from '../hostaway/client.js'
import type { CalendarDay, GapNight, ToolDefinition } from '../hostaway/types.js'

export const calendarTools: ToolDefinition[] = [
  {
    name: 'get_calendar',
    description: 'Returns availability and pricing calendar for a listing within a date range.',
    inputSchema: {
      type: 'object',
      properties: {
        listingId: { type: 'number', description: 'Listing ID' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['listingId', 'startDate', 'endDate'],
    },
    handler: async (args) => {
      try {
        const listingId = validateId(args.listingId, 'listingId')
        if (!isValidDate(args.startDate as string) || !isValidDate(args.endDate as string)) {
          return {
            content: [{ type: 'text', text: 'Invalid date format. Please use YYYY-MM-DD.' }],
            isError: true,
          }
        }
        const calendar = await hostawayRequest<CalendarDay[]>(
          'GET',
          `/listings/${listingId}/calendar`,
          undefined,
          { startDate: args.startDate, endDate: args.endDate }
        )
        return toolResult({ listingId, days: calendar })
      } catch (error) {
        return toolError(error)
      }
    },
  },

  {
    name: 'get_gap_nights',
    description:
      'Analyses the calendar to find gap nights (short unbooked gaps between reservations). Useful for identifying revenue optimization opportunities.',
    inputSchema: {
      type: 'object',
      properties: {
        listingId: { type: 'number', description: 'Listing ID' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD, default: today)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD, default: 90 days from today)' },
        maxGapLength: { type: 'number', description: 'Max gap size to report (default: 3)' },
      },
      required: ['listingId'],
    },
    handler: async (args) => {
      try {
        const today = new Date()
        const startDate = (args.startDate as string) || today.toISOString().split('T')[0]
        const endDate =
          (args.endDate as string) ||
          new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const maxGap = (args.maxGapLength as number) || 3
        const listingId = validateId(args.listingId, 'listingId')

        const calendar = await hostawayRequest<CalendarDay[]>(
          'GET',
          `/listings/${listingId}/calendar`,
          undefined,
          { startDate, endDate }
        )

        // Find gaps: sequences of available days bounded by unavailable days
        const gaps: GapNight[] = []
        let gapStart: string | null = null
        let gapLength = 0

        for (let i = 0; i < calendar.length; i++) {
          const day = calendar[i]
          const isAvailable = day.isAvailable === 1 && !day.reservationId

          if (isAvailable) {
            if (!gapStart) gapStart = day.date
            gapLength++
          } else {
            if (gapStart && gapLength > 0 && gapLength <= maxGap) {
              // Check if this gap is bounded by reservations (not just end of range)
              const hasPriorBooking = i - gapLength - 1 >= 0 && calendar[i - gapLength - 1]?.reservationId
              if (hasPriorBooking) {
                gaps.push({
                  startDate: gapStart,
                  endDate: day.date,
                  length: gapLength,
                  listingId,
                })
              }
            }
            gapStart = null
            gapLength = 0
          }
        }

        return toolResult({
          listingId,
          dateRange: { startDate, endDate },
          maxGapLength: maxGap,
          gapsFound: gaps.length,
          gaps,
        })
      } catch (error) {
        return toolError(error)
      }
    },
  },

  {
    name: 'create_calendar_block',
    description: 'Block dates on a listing calendar. Blocked if HOSTAWAY_READ_ONLY is true.',
    inputSchema: {
      type: 'object',
      properties: {
        listingId: { type: 'number', description: 'Listing ID' },
        startDate: { type: 'string', description: 'Block start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'Block end date (YYYY-MM-DD)' },
        note: { type: 'string', description: 'Reason for the block' },
      },
      required: ['listingId', 'startDate', 'endDate'],
    },
    handler: async (args) => {
      if (isReadOnly()) return readOnlyError()
      try {
        const listingId = validateId(args.listingId, 'listingId')
        if (!isValidDate(args.startDate as string) || !isValidDate(args.endDate as string)) {
          return {
            content: [{ type: 'text', text: 'Invalid date format. Please use YYYY-MM-DD.' }],
            isError: true,
          }
        }
        const payload: Record<string, unknown> = {
          startDate: args.startDate,
          endDate: args.endDate,
        }
        if (args.note) payload.note = args.note

        await hostawayRequest<unknown>(
          'POST',
          `/listings/${listingId}/calendar`,
          payload
        )
        return toolResult({ success: true, listingId, ...payload })
      } catch (error) {
        return toolError(error)
      }
    },
  },

  {
    name: 'delete_calendar_block',
    description: 'Remove a calendar block from a listing. Blocked if HOSTAWAY_READ_ONLY is true.',
    inputSchema: {
      type: 'object',
      properties: {
        listingId: { type: 'number', description: 'Listing ID' },
        calendarBlockId: { type: 'number', description: 'Calendar block ID to remove' },
      },
      required: ['listingId', 'calendarBlockId'],
    },
    handler: async (args) => {
      if (isReadOnly()) return readOnlyError()
      try {
        const listingId = validateId(args.listingId, 'listingId')
        const blockId = validateId(args.calendarBlockId, 'calendarBlockId')
        await hostawayRequest<unknown>(
          'DELETE',
          `/listings/${listingId}/calendar/${blockId}`
        )
        return toolResult({ success: true, deleted: blockId })
      } catch (error) {
        return toolError(error)
      }
    },
  },
]

function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(new Date(date).getTime())
}

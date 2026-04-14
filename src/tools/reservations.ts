import { hostawayRequest, isReadOnly, readOnlyError, toolResult, toolError } from '../hostaway/client.js'
import { CHANNEL_NAMES, type Reservation, type ToolDefinition } from '../hostaway/types.js'

export const reservationTools: ToolDefinition[] = [
  {
    name: 'list_reservations',
    description: 'List reservations with optional filters for listing, dates, status, and channel.',
    inputSchema: {
      type: 'object',
      properties: {
        listingMapId: { type: 'number', description: 'Filter by specific listing ID' },
        dateFrom: { type: 'string', description: 'Check-in date from (YYYY-MM-DD)' },
        dateTo: { type: 'string', description: 'Check-in date to (YYYY-MM-DD)' },
        status: {
          type: 'string',
          description: 'Reservation status filter',
          enum: ['new', 'modified', 'cancelled', 'inquiry', 'declined'],
        },
        channelId: { type: 'number', description: 'Filter by OTA channel ID (2000=Airbnb, 2003=Booking.com, 2009=VRBO, 2014=Direct)' },
        limit: { type: 'number', description: 'Max results (default 50, max 100)' },
        offset: { type: 'number', description: 'Pagination offset' },
      },
    },
    handler: async (args) => {
      try {
        const params: Record<string, unknown> = {}
        if (args.listingMapId) params.listingMapId = args.listingMapId
        if (args.dateFrom) params.arrivalDateFrom = args.dateFrom
        if (args.dateTo) params.arrivalDateTo = args.dateTo
        if (args.status) params.status = args.status
        if (args.channelId) params.channelId = args.channelId
        params.limit = Math.min((args.limit as number) || 50, 100)
        if (args.offset) params.offset = args.offset

        const reservations = await hostawayRequest<Reservation[]>('GET', '/reservations', undefined, params)

        const enriched = reservations.map((r) => ({
          ...r,
          channelName: CHANNEL_NAMES[r.channelId] || `Channel ${r.channelId}`,
        }))

        return toolResult({ count: enriched.length, reservations: enriched })
      } catch (error) {
        return toolError(error)
      }
    },
  },

  {
    name: 'get_reservation',
    description: 'Get full details of a single reservation by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        reservationId: { type: 'number', description: 'Hostaway reservation ID' },
      },
      required: ['reservationId'],
    },
    handler: async (args) => {
      try {
        const reservation = await hostawayRequest<Reservation>(
          'GET',
          `/reservations/${args.reservationId}`
        )
        reservation.channelName = CHANNEL_NAMES[reservation.channelId] || `Channel ${reservation.channelId}`
        return toolResult(reservation)
      } catch (error) {
        return toolError(error)
      }
    },
  },

  {
    name: 'update_reservation_host_note',
    description: 'Update the internal host note on a reservation. Blocked if HOSTAWAY_READ_ONLY is true.',
    inputSchema: {
      type: 'object',
      properties: {
        reservationId: { type: 'number', description: 'Reservation ID' },
        hostNote: { type: 'string', description: 'New host note content' },
      },
      required: ['reservationId', 'hostNote'],
    },
    handler: async (args) => {
      if (isReadOnly()) return readOnlyError()
      try {
        await hostawayRequest<Reservation>(
          'PUT',
          `/reservations/${args.reservationId}`,
          { hostNote: args.hostNote }
        )
        return toolResult({ success: true, reservationId: args.reservationId, hostNote: args.hostNote })
      } catch (error) {
        return toolError(error)
      }
    },
  },

  {
    name: 'list_reservations_by_property',
    description:
      'Returns all current and upcoming reservations grouped by listing name. Useful for a portfolio overview.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        let allReservations: Reservation[] = []
        let offset = 0
        const limit = 100

        // Fetch all pages
        while (true) {
          const batch = await hostawayRequest<Reservation[]>(
            'GET',
            '/reservations',
            undefined,
            { departureDateFrom: today, limit, offset, sortOrder: 'arrivalDate' }
          )
          allReservations = allReservations.concat(batch)
          if (batch.length < limit) break
          offset += limit
        }

        // Group by listing
        const grouped: Record<string, Array<{ id: number; guest: string; checkin: string; checkout: string; status: string; channel: string }>> = {}

        for (const r of allReservations) {
          const listingKey = r.listingName || `Listing ${r.listingMapId}`
          if (!grouped[listingKey]) grouped[listingKey] = []
          grouped[listingKey].push({
            id: r.id,
            guest: `${r.guestFirstName} ${r.guestLastName}`,
            checkin: r.arrivalDate,
            checkout: r.departureDate,
            status: r.status,
            channel: CHANNEL_NAMES[r.channelId] || `Channel ${r.channelId}`,
          })
        }

        return toolResult({ totalReservations: allReservations.length, byProperty: grouped })
      } catch (error) {
        return toolError(error)
      }
    },
  },
]

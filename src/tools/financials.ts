import { hostawayRequest, toolResult, toolError } from '../hostaway/client.js'
import { CHANNEL_NAMES, type Reservation, type ToolDefinition } from '../hostaway/types.js'

export const financialTools: ToolDefinition[] = [
  {
    name: 'get_reservation_financials',
    description: 'Returns the financial breakdown for a single reservation (revenue, payout, fees, commission, taxes).',
    inputSchema: {
      type: 'object',
      properties: {
        reservationId: { type: 'number', description: 'Reservation ID' },
      },
      required: ['reservationId'],
    },
    handler: async (args) => {
      try {
        const r = await hostawayRequest<Reservation>('GET', `/reservations/${args.reservationId}`)

        // Parse money array for detailed breakdown
        const moneyMap: Record<string, number> = {}
        if (r.money && Array.isArray(r.money)) {
          for (const m of r.money) {
            moneyMap[m.type] = m.amount
          }
        }

        return toolResult({
          reservationId: r.id,
          guest: `${r.guestFirstName} ${r.guestLastName}`,
          listing: r.listingName || `Listing ${r.listingMapId}`,
          channel: CHANNEL_NAMES[r.channelId] || `Channel ${r.channelId}`,
          checkin: r.arrivalDate,
          checkout: r.departureDate,
          nights: r.nights,
          totalPrice: r.totalPrice,
          hostPayout: r.hostPayout,
          cleaningFee: r.cleaningFee,
          channelCommission: r.channelCommissionAmount,
          moneyBreakdown: moneyMap,
        })
      } catch (error) {
        return toolError(error)
      }
    },
  },

  {
    name: 'get_revenue_summary',
    description:
      'Returns aggregated revenue across all or selected listings for a date range. Includes per-listing breakdown and totals.',
    inputSchema: {
      type: 'object',
      properties: {
        dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        dateTo: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        listingId: { type: 'number', description: 'Optionally filter to one listing' },
      },
      required: ['dateFrom', 'dateTo'],
    },
    handler: async (args) => {
      try {
        // Fetch all reservations in range (paginated)
        let allReservations: Reservation[] = []
        let offset = 0
        const limit = 100
        const params: Record<string, unknown> = {
          arrivalDateFrom: args.dateFrom,
          arrivalDateTo: args.dateTo,
          limit,
        }
        if (args.listingId) params.listingMapId = args.listingId

        while (true) {
          params.offset = offset
          const batch = await hostawayRequest<Reservation[]>('GET', '/reservations', undefined, params)
          allReservations = allReservations.concat(batch)
          if (batch.length < limit) break
          offset += limit
        }

        // Filter out cancelled
        const active = allReservations.filter((r) => r.status !== 'cancelled')

        // Aggregate per listing
        const byListing: Record<
          string,
          { listingId: number; name: string; totalRevenue: number; totalPayout: number; cleaningFees: number; reservationCount: number }
        > = {}

        let totalRevenue = 0
        let totalPayout = 0
        let totalCleaningFees = 0

        for (const r of active) {
          const key = r.listingName || `Listing ${r.listingMapId}`
          if (!byListing[key]) {
            byListing[key] = {
              listingId: r.listingMapId,
              name: key,
              totalRevenue: 0,
              totalPayout: 0,
              cleaningFees: 0,
              reservationCount: 0,
            }
          }
          const price = r.totalPrice || 0
          const payout = r.hostPayout || 0
          const cleaning = r.cleaningFee || 0

          byListing[key].totalRevenue += price
          byListing[key].totalPayout += payout
          byListing[key].cleaningFees += cleaning
          byListing[key].reservationCount++

          totalRevenue += price
          totalPayout += payout
          totalCleaningFees += cleaning
        }

        return toolResult({
          dateRange: { from: args.dateFrom, to: args.dateTo },
          totalReservations: active.length,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalHostPayout: Math.round(totalPayout * 100) / 100,
          totalCleaningFees: Math.round(totalCleaningFees * 100) / 100,
          byListing: Object.values(byListing).map((l) => ({
            ...l,
            totalRevenue: Math.round(l.totalRevenue * 100) / 100,
            totalPayout: Math.round(l.totalPayout * 100) / 100,
            cleaningFees: Math.round(l.cleaningFees * 100) / 100,
          })),
        })
      } catch (error) {
        return toolError(error)
      }
    },
  },

  {
    name: 'get_payout_report',
    description:
      'Returns a payout-style report for reconciliation against Airbnb/Booking.com statements. Per-reservation rows with financials.',
    inputSchema: {
      type: 'object',
      properties: {
        dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        dateTo: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        channelId: { type: 'number', description: 'Filter by channel (2000=Airbnb, 2003=Booking.com, 2009=VRBO)' },
      },
      required: ['dateFrom', 'dateTo'],
    },
    handler: async (args) => {
      try {
        let allReservations: Reservation[] = []
        let offset = 0
        const limit = 100
        const params: Record<string, unknown> = {
          arrivalDateFrom: args.dateFrom,
          arrivalDateTo: args.dateTo,
          limit,
        }
        if (args.channelId) params.channelId = args.channelId

        while (true) {
          params.offset = offset
          const batch = await hostawayRequest<Reservation[]>('GET', '/reservations', undefined, params)
          allReservations = allReservations.concat(batch)
          if (batch.length < limit) break
          offset += limit
        }

        const rows = allReservations.map((r) => ({
          reservationId: r.id,
          guestName: `${r.guestFirstName} ${r.guestLastName}`,
          listing: r.listingName || `Listing ${r.listingMapId}`,
          checkin: r.arrivalDate,
          checkout: r.departureDate,
          nights: r.nights,
          channel: CHANNEL_NAMES[r.channelId] || `Channel ${r.channelId}`,
          totalPrice: r.totalPrice,
          hostPayout: r.hostPayout,
          channelCommission: r.channelCommissionAmount,
          status: r.status,
        }))

        const totalPayout = rows.reduce((sum, r) => sum + (r.hostPayout || 0), 0)

        return toolResult({
          dateRange: { from: args.dateFrom, to: args.dateTo },
          channel: args.channelId ? CHANNEL_NAMES[args.channelId as number] || `Channel ${args.channelId}` : 'All',
          totalReservations: rows.length,
          totalPayout: Math.round(totalPayout * 100) / 100,
          rows,
        })
      } catch (error) {
        return toolError(error)
      }
    },
  },
]

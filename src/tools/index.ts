import { reservationTools } from './reservations.js'
import { listingTools } from './listings.js'
import { calendarTools } from './calendar.js'
import { financialTools } from './financials.js'
import { conversationTools } from './conversations.js'
import type { ToolDefinition } from '../hostaway/types.js'

export const allTools: ToolDefinition[] = [
  ...reservationTools,
  ...listingTools,
  ...calendarTools,
  ...financialTools,
  ...conversationTools,
]

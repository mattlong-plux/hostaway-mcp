// Hostaway API response wrapper
export interface HostawayResponse<T> {
  status: string
  result: T
}

// Listing
export interface Listing {
  id: number
  name: string
  internalListingName: string
  airbnbListingUrl?: string
  vrboListingUrl?: string
  bedrooms: number
  bathrooms: number
  personCapacity: number
  city: string
  countryCode: string
  isArchived: boolean
  customFieldValues?: CustomFieldValue[]
  [key: string]: unknown
}

// Reservation
export interface Reservation {
  id: number
  listingMapId: number
  listingName?: string
  channelId: number
  channelName?: string
  guestName: string
  guestFirstName: string
  guestLastName: string
  guestEmail: string
  guestPhone: string
  arrivalDate: string
  departureDate: string
  nights: number
  adults: number
  children: number
  infants: number
  status: string
  totalPrice: number
  hostPayout?: number
  cleaningFee?: number
  channelCommissionAmount?: number
  hostNote?: string
  source?: string
  money?: ReservationMoney[]
  [key: string]: unknown
}

export interface ReservationMoney {
  type: string
  amount: number
  currency: string
  [key: string]: unknown
}

// Calendar
export interface CalendarDay {
  date: string
  isAvailable: number
  isBlocked?: number
  price?: number
  minimumStay?: number
  reservationId?: number
  [key: string]: unknown
}

export interface CalendarBlock {
  id: number
  listingId: number
  startDate: string
  endDate: string
  note?: string
  [key: string]: unknown
}

// Conversation
export interface Conversation {
  id: number
  reservationId?: number
  listingMapId?: number
  guestName?: string
  lastMessage?: string
  lastMessageDate?: string
  isRead?: boolean
  [key: string]: unknown
}

export interface Message {
  id: number
  conversationId: number
  body: string
  senderName?: string
  isIncoming: boolean
  insertedOn?: string
  [key: string]: unknown
}

// Custom fields
export interface CustomFieldValue {
  fieldId: number
  fieldName?: string
  value: string | number | boolean | null
  [key: string]: unknown
}

// Channel name map
export const CHANNEL_NAMES: Record<number, string> = {
  2000: 'Airbnb',
  2003: 'Booking.com',
  2009: 'VRBO',
  2014: 'Direct',
  2018: 'Expedia',
  2024: 'Google Vacation Rentals',
  2027: 'TripAdvisor',
}

// Gap night analysis result
export interface GapNight {
  startDate: string
  endDate: string
  length: number
  listingId: number
}

// Tool definition interface
export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>
    isError?: boolean
  }>
}

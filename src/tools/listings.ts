import { hostawayRequest, toolResult, toolError, validateId } from '../hostaway/client.js'
import type { Listing, CustomFieldValue, ToolDefinition } from '../hostaway/types.js'

export const listingTools: ToolDefinition[] = [
  {
    name: 'list_listings',
    description: 'Returns all active listings with key metadata (name, URLs, capacity, location).',
    inputSchema: {
      type: 'object',
      properties: {
        includeArchived: { type: 'boolean', description: 'Include archived listings (default false)' },
      },
    },
    handler: async (args) => {
      try {
        const listings = await hostawayRequest<Listing[]>('GET', '/listings')

        let filtered = listings
        if (!args.includeArchived) {
          filtered = listings.filter((l) => !l.isArchived)
        }

        const summary = filtered.map((l) => ({
          id: l.id,
          name: l.name,
          internalListingName: l.internalListingName,
          airbnbListingUrl: l.airbnbListingUrl,
          vrboListingUrl: l.vrboListingUrl,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          personCapacity: l.personCapacity,
          city: l.city,
          countryCode: l.countryCode,
        }))

        return toolResult({ count: summary.length, listings: summary })
      } catch (error) {
        return toolError(error)
      }
    },
  },

  {
    name: 'get_listing',
    description: 'Get full details for a single listing by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        listingId: { type: 'number', description: 'Listing ID' },
      },
      required: ['listingId'],
    },
    handler: async (args) => {
      try {
        const id = validateId(args.listingId, 'listingId')
        const listing = await hostawayRequest<Listing>('GET', `/listings/${id}`)
        return toolResult(listing)
      } catch (error) {
        return toolError(error)
      }
    },
  },

  {
    name: 'get_listing_custom_fields',
    description: 'Returns all custom field values for a listing as a readable name-value map.',
    inputSchema: {
      type: 'object',
      properties: {
        listingId: { type: 'number', description: 'Listing ID' },
      },
      required: ['listingId'],
    },
    handler: async (args) => {
      try {
        const id = validateId(args.listingId, 'listingId')
        const fields = await hostawayRequest<CustomFieldValue[]>(
          'GET',
          `/listings/${id}/customFieldValues`
        )

        // Transform array to readable map
        const fieldMap: Record<string, unknown> = {}
        for (const f of fields) {
          const key = f.fieldName || `field_${f.fieldId}`
          fieldMap[key] = f.value
        }

        return toolResult({ listingId: args.listingId, customFields: fieldMap })
      } catch (error) {
        return toolError(error)
      }
    },
  },
]

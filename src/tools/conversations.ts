import { hostawayRequest, isReadOnly, readOnlyError, toolResult, toolError, validateId } from '../hostaway/client.js'
import type { Conversation, Message, ToolDefinition } from '../hostaway/types.js'

export const conversationTools: ToolDefinition[] = [
  {
    name: 'list_conversations',
    description: 'Returns recent guest conversations with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        listingId: { type: 'number', description: 'Filter by listing ID' },
        limit: { type: 'number', description: 'Max results (default 20)' },
        unreadOnly: { type: 'boolean', description: 'Only return unread conversations (default false)' },
      },
    },
    handler: async (args) => {
      try {
        const params: Record<string, unknown> = {
          limit: (args.limit as number) || 20,
        }
        if (args.listingId) params.listingMapId = args.listingId

        const conversations = await hostawayRequest<Conversation[]>('GET', '/conversations', undefined, params)

        let filtered = conversations
        if (args.unreadOnly) {
          filtered = conversations.filter((c) => !c.isRead)
        }

        return toolResult({ count: filtered.length, conversations: filtered })
      } catch (error) {
        return toolError(error)
      }
    },
  },

  {
    name: 'get_conversation',
    description: 'Returns the full message thread for a conversation.',
    inputSchema: {
      type: 'object',
      properties: {
        conversationId: { type: 'number', description: 'Conversation ID' },
      },
      required: ['conversationId'],
    },
    handler: async (args) => {
      try {
        const id = validateId(args.conversationId, 'conversationId')
        const messages = await hostawayRequest<Message[]>(
          'GET',
          `/conversations/${id}/messages`
        )
        return toolResult({ conversationId: id, messageCount: messages.length, messages })
      } catch (error) {
        return toolError(error)
      }
    },
  },

  {
    name: 'send_message',
    description: 'Send a message to a guest in a conversation. Blocked if HOSTAWAY_READ_ONLY is true.',
    inputSchema: {
      type: 'object',
      properties: {
        conversationId: { type: 'number', description: 'Conversation ID' },
        message: { type: 'string', description: 'Message body to send' },
      },
      required: ['conversationId', 'message'],
    },
    handler: async (args) => {
      if (isReadOnly()) return readOnlyError()
      try {
        const id = validateId(args.conversationId, 'conversationId')
        const message = args.message as string
        if (!message || message.length === 0) {
          return { content: [{ type: 'text', text: 'Message body cannot be empty.' }], isError: true }
        }
        if (message.length > 5000) {
          return { content: [{ type: 'text', text: 'Message too long. Maximum length is 5000 characters.' }], isError: true }
        }
        await hostawayRequest<Message>(
          'POST',
          `/conversations/${id}/messages`,
          { body: message }
        )
        return toolResult({ success: true, conversationId: id, messageSent: message })
      } catch (error) {
        return toolError(error)
      }
    },
  },
]

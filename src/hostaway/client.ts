import axios, { AxiosError } from 'axios'
import { getAccessToken } from './auth.js'

const BASE_URL = 'https://api.hostaway.com/v1'

export async function hostawayRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  data?: Record<string, unknown>,
  params?: Record<string, unknown>
): Promise<T> {
  const token = await getAccessToken()

  const response = await axios({
    method,
    url: `${BASE_URL}${path}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Cache-control': 'no-cache',
    },
    data,
    params,
  })

  return response.data.result ?? response.data
}

export function formatApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status
    if (status === 401) {
      return 'Invalid Hostaway credentials. Check HOSTAWAY_ACCOUNT_ID and HOSTAWAY_CLIENT_SECRET.'
    }
    if (status === 404) {
      return 'Resource not found in your Hostaway account.'
    }
    if (status === 429) {
      return 'Hostaway API rate limit reached. Please wait a moment and retry.'
    }
    if (status && status >= 500) {
      return `Hostaway API returned an error (${status}). Try again shortly.`
    }
    return `Hostaway API error: ${error.message}`
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'An unexpected error occurred.'
}

export function isReadOnly(): boolean {
  return process.env.HOSTAWAY_READ_ONLY === 'true'
}

export function readOnlyError(): { content: Array<{ type: string; text: string }>; isError: true } {
  return {
    content: [{ type: 'text', text: 'This tool is disabled because HOSTAWAY_READ_ONLY is set to true.' }],
    isError: true,
  }
}

export function toolResult(data: unknown): { content: Array<{ type: string; text: string }> } {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  }
}

export function toolError(error: unknown): { content: Array<{ type: string; text: string }>; isError: true } {
  return {
    content: [{ type: 'text', text: formatApiError(error) }],
    isError: true,
  }
}

export function validateId(value: unknown, name: string): number {
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) {
    throw new RangeError(`Invalid ${name}: must be a positive integer.`)
  }
  return num
}

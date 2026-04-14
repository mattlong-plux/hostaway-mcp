import axios from 'axios'

interface TokenData {
  accessToken: string
  expiresAt: number
}

let cachedToken: TokenData | null = null

function getCacheTtl(): number {
  const envTtl = process.env.HOSTAWAY_CACHE_TTL
  return envTtl ? parseInt(envTtl, 10) : 240
}

export async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt - now > 60) {
    return cachedToken.accessToken
  }

  const accountId = process.env.HOSTAWAY_ACCOUNT_ID
  const clientSecret = process.env.HOSTAWAY_CLIENT_SECRET

  if (!accountId || !clientSecret) {
    throw new Error(
      'Missing required environment variables: HOSTAWAY_ACCOUNT_ID and HOSTAWAY_CLIENT_SECRET must be set.'
    )
  }

  const response = await axios.post(
    'https://api.hostaway.com/v1/accessTokens',
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: accountId,
      client_secret: clientSecret,
      scope: 'general',
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  )

  const { access_token, expires_in } = response.data
  const ttl = expires_in || getCacheTtl()

  cachedToken = {
    accessToken: access_token,
    expiresAt: now + ttl,
  }

  return cachedToken.accessToken
}

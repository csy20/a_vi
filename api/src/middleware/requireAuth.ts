import { type RequestHandler } from 'express'
import { expressjwt, type GetVerificationKey } from 'express-jwt'
import jwksRsa from 'jwks-rsa'

export function buildRequireAuth(): RequestHandler {
  const supabaseUrl = process.env.SUPABASE_URL

  if (!supabaseUrl) {
    console.error('⚠️  SUPABASE_URL environment variable is not set!')
    console.error('Please add it to your .env file in the api/ directory.')

    return (_req, res) => {
      res.status(500).json({ success: false, error: 'SUPABASE_URL is not configured' })
    }
  }

  const issuer = `${supabaseUrl}/auth/v1`

  return expressjwt({
    secret: jwksRsa.expressJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `${issuer}/.well-known/jwks.json`,
    }) as GetVerificationKey,
    audience: 'authenticated',
    issuer,
    algorithms: ['RS256'],
    credentialsRequired: true,
    getToken: (req) => {
      const header = req.headers.authorization
      if (!header?.startsWith('Bearer ')) {
        return undefined
      }

      return header.slice('Bearer '.length).trim()
    },
  }) as RequestHandler
}

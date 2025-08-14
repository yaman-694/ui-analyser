import { verifyToken } from '@clerk/backend'
import { NextFunction, Response } from 'express'
import { RequestExtended } from '../types'

const verifyClerkAuth = async (
  req: RequestExtended,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' })
      return
    }

    const token = authHeader.replace('Bearer ', '')

    const payload = await verifyToken(token, {
      secretKey   : process.env.CLERK_SECRET_KEY, // or rely on Clerk's default JWKS URL
    })

    // Attach the user info to the request
    req.userId = payload.sub
    next()
  } catch (err) {
    console.error('Auth verification failed:', err)
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
}

export default verifyClerkAuth

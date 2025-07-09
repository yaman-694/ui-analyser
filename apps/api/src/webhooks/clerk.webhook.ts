import { NextFunction, Request, Response } from 'express'
import { Webhook } from 'svix'
import { HTTP_STATUS_CODE } from '../constants/constants'
import User from '../model/user.model'

interface WebhookEvent {
  data: {
    id: string
    email_addresses: Array<{
      email_address: string
      id: string
    }>
    username?: string
    first_name?: string
    last_name?: string
    created_at: string
    updated_at: string
  }
  object: string
  type: string
}

export const clerkWebhookHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get the webhook secret from environment variables
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

    if (!WEBHOOK_SECRET) {
      res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Server configuration error'
      })
      return
    }

    // Get the headers
    const svix_id = req.headers['svix-id'] as string
    const svix_timestamp = req.headers['svix-timestamp'] as string
    const svix_signature = req.headers['svix-signature'] as string

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Missing Svix headers'
      })
      return
    }

    // Create a new Svix instance with our secret
    const wh = new Webhook(WEBHOOK_SECRET)

    // Verify the payload with the headers
    let evt: WebhookEvent

    try {
      // For webhook routes using express.raw(), the body will be the raw Buffer
      let payload: string

      if (Buffer.isBuffer(req.body)) {
        // If the body is a Buffer (from express.raw())
        payload = req.body.toString()
      } else {
        // If the body is already parsed
        payload = JSON.stringify(req.body)
      }

      evt = wh.verify(payload, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature
      }) as WebhookEvent
    } catch (err) {
      res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Error verifying webhook'
      })
      return
    }

    // Get the event data
    const { type: eventType, data } = evt

    // Process the event
    switch (eventType) {
      case 'user.created': {
        const { id, email_addresses, first_name, last_name } = data

        // Extract the first email address
        const email = email_addresses[0]?.email_address

        // Check if the user is present or not
        const user = await User.findOne({ email });

        if (user) {
          res.status(HTTP_STATUS_CODE.OK).json({
            success: true,
            message: 'User already exists',
            data: user
          })
          return
        }

        await User.create({
          clerkId: id,
          email: email,
          name: [first_name, last_name].filter(Boolean).join(' ') || null,
          credits: 5 // Default credits for new users
        })

        if (!email) {
          res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
            success: false,
            message: 'No email found for user'
          })
          return
        }

        res.status(HTTP_STATUS_CODE.CREATED).json({
          success: true,
          message: 'User created successfully',
          data: user
        })
        return
      }

      case 'user.deleted': {

        const { id } = data
        // Find the user by Clerk ID
        const user = await User.findOne({
          clerkId: id
        })
        if (!user) {
          res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
            success: false,
            message: 'User not found'
          })
          return
        }
        // Handle user deletion if needed
        res.status(HTTP_STATUS_CODE.OK).json({
          success: true,
          message: 'User delete event received'
        })
        return
      }

      default: {
        // Handle other event types or ignore them
        res.status(HTTP_STATUS_CODE.OK).json({
          success: true,
          message: `Event received: ${eventType}`
        })
      }
    }
  } catch (error) {
    next(error)
  }
}

export default clerkWebhookHandler

import { NextFunction, Request, Response } from 'express'
import Stripe from 'stripe'
import { Plan } from '../../generated/prisma'
import { BASE_SUBSCRIPTION_PLAN, HTTP_STATUS_CODE, PLUS_SUBSCRIPTION_PLAN, STRIPE } from '../constants/constants'
import prisma from '../prisma/prisma'

// Initialize Stripe with the secret key from environment variables
const stripe = new Stripe(STRIPE.apiKey!, {
  apiVersion: '2025-05-28.basil' // Using the latest API version available in June 2025
})

// Function to handle Stripe webhook events
const stripeWebhookHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const signature = req.headers['stripe-signature'] as string
    const webhookSecret = STRIPE.webhookSecret

    if (!signature || !webhookSecret) {
      res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'Missing Stripe signature or webhook secret'
      })
      return
    }

    let payload: string

    if (Buffer.isBuffer(req.body)) {
      // If the body is a Buffer (from express.raw())
      payload = req.body.toString()
    } else {
      // If the body is already parsed
      payload = JSON.stringify(req.body)
    }

    // Verify the webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
    } catch (err) {
      const error = err as Error
      console.error(`Webhook signature verification failed: ${error.message}`)
      res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: `Webhook signature verification failed: ${error.message}`
      })
      return
    }

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event)
        break
      // case 'customer.subscription.deleted':
      //   await handleSubscriptionDeleted(event);
      //   break;
      default:
      // console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.status(HTTP_STATUS_CODE.OK).json({ received: true })
  } catch (error) {
    next(error)
  }
}

// Handle subscription updated events
const handleSubscriptionUpdated = async (event: Stripe.Event) => {
  const subscription = event.data.object as Stripe.Subscription
  const customerId = subscription.customer as string
  const subscriptionId = subscription.id
  const priceId = subscription.items.data[0].price.id
  const session = event.data.object as Stripe.Checkout.Session
  const clerkUserId = session.metadata?.userId

  // Use currentPeriodEndDate instead of current_period_end for newer Stripe API version
  const currentPeriodEndUnix = subscription.items.data[0]?.current_period_end

  if (!currentPeriodEndUnix) {
    throw new Error('Subscription period end not found.')
  }

  const currentPeriodEnd = new Date(currentPeriodEndUnix * 1000) // Convert from UNIX timestamp

  try {

    let currentPlan: Plan = Plan.FREE // Default to free plan

    if (subscription.items.data[0].price.id === BASE_SUBSCRIPTION_PLAN.id) {
      currentPlan = Plan.BASE
    } else if (subscription.items.data[0].price.id === PLUS_SUBSCRIPTION_PLAN.id) {
      currentPlan = Plan.PLUS
    }

    const creditsToBeGranted = currentPlan === Plan.BASE ? BASE_SUBSCRIPTION_PLAN.credit : currentPlan === Plan.PLUS ? PLUS_SUBSCRIPTION_PLAN.credit : 20

    // Update the user's subscription information
    const user = await prisma.user.update({
      where: { id: clerkUserId },
      data: {
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
        stripeCustomerId: customerId,
        stripeCurrentPeriodEnd: currentPeriodEnd,
        isActive: subscription.status === 'active',
        currentPlan: currentPlan,
        credits: creditsToBeGranted,
        dailyCreditsLastRefreshed: new Date(), // Reset daily credits on subscription update
      }
    })

    if (!user) {
      throw new Error(`User with ID ${clerkUserId} not found.`)
    }

    console.log(`Updated subscription for user: ${user.id}`)
  } catch (error) {
    console.error('Error updating subscription:', error)
  }
}

// Handle subscription deleted events
const handleSubscriptionDeleted = async (event: Stripe.Event) => {
  const subscription = event.data.object as Stripe.Subscription
  const subscriptionId = subscription.id

  try {
    // Find the user with this subscription
    const user = await prisma.user.findUnique({
      where: { stripeSubscriptionId: subscriptionId }
    })

    if (!user) {
      console.error(`No user found with subscription ID: ${subscriptionId}`)
      return
    }

    // Update the user to reflect the cancelled subscription
    await prisma.user.update({
      where: { id: user.id },
      data: {
        // Keep the IDs for reference, but mark the subscription as inactive
        isActive: false
      }
    })

    console.log(`Marked subscription as inactive for user: ${user.id}`)
  } catch (error) {
    console.error('Error handling subscription deletion:', error)
  }
}

// Handle checkout session completed events
const handleCheckoutSessionCompleted = async (event: Stripe.Event) => {
  const session = event.data.object as Stripe.Checkout.Session

  // Only process successful subscriptions
  if (session.mode !== 'subscription' || !session.subscription) {
    return
  }

  const customerId = session.customer as string
  const subscriptionId = session.subscription as string

  try {
    // Get the subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const priceId = subscription.items.data[0].price.id

    // Use currentPeriodEndDate instead of current_period_end for newer Stripe API version
    const currentPeriodEnd = new Date(
      (subscription as any).currentPeriodEndDate * 1000
    )

    // Get the customer email
    const customer = (await stripe.customers.retrieve(
      customerId
    )) as Stripe.Customer
    const email = customer.email

    if (!email) {
      console.error('No email found for customer:', customerId)
      return
    }

    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email }
    })

    if (user) {
      // Update existing user
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripePriceId: priceId,
          stripeCurrentPeriodEnd: currentPeriodEnd,
          isActive: subscription.status === 'active'
        }
      })
      console.log(`Updated existing user: ${user.id}`)
    } else {
      // Create new user if this is their first interaction
      user = await prisma.user.create({
        data: {
          email,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripePriceId: priceId,
          stripeCurrentPeriodEnd: currentPeriodEnd,
          isActive: subscription.status === 'active'
        }
      })
      console.log(`Created new user: ${user.id}`)
    }
  } catch (error) {
    console.error('Error handling checkout session completion:', error)
  }
}

export default stripeWebhookHandler

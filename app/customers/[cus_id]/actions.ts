'use server'

import { revalidatePath } from 'next/cache'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'

// --- Pause helpers ---

// Marks subscription schedules the portal created solely to hold a pause schedule,
// so we know it's safe to release them once the pause is no longer needed.
const PORTAL_MANAGED_KEY = 'managed_by'
const PORTAL_MANAGED_VALUE = 'portal_pause'

function isPortalManaged(schedule: Stripe.SubscriptionSchedule): boolean {
  return schedule.metadata?.[PORTAL_MANAGED_KEY] === PORTAL_MANAGED_VALUE
}

async function retrieveOwnedSubscription(
  subscriptionId: string,
  customerId: string
): Promise<{
  sub: Stripe.Subscription
  schedule: Stripe.SubscriptionSchedule | null
}> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['schedule'],
  })
  const subCustomer =
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  if (subCustomer !== customerId) {
    throw new Error('Subscription not found')
  }
  return { sub, schedule: sub.schedule as Stripe.SubscriptionSchedule | null }
}

async function createPortalSchedule(
  subscriptionId: string,
  pauseSchedules: Stripe.SubscriptionScheduleCreateParams.PauseSchedule[]
): Promise<void> {
  const schedule = await stripe.subscriptionSchedules.create({
    from_subscription: subscriptionId,
    pause_schedules: pauseSchedules,
  })
  // Stripe rejects `metadata` alongside `from_subscription`, so tag it separately
  await stripe.subscriptionSchedules.update(schedule.id, {
    metadata: { [PORTAL_MANAGED_KEY]: PORTAL_MANAGED_VALUE },
  })
}

function errorResult(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : 'Something went wrong' }
}

export async function cancelSubscriptionAtPeriodEnd(
  subscriptionId: string,
  path: string
): Promise<{ error?: string }> {
  try {
    // Subscriptions attached to a schedule can't change cancelation behavior directly.
    // Schedules the portal created only exist to hold a pause, so release them first.
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['schedule'],
    })
    const schedule = sub.schedule as Stripe.SubscriptionSchedule | null
    if (schedule && isPortalManaged(schedule)) {
      await stripe.subscriptionSchedules.release(schedule.id)
    }

    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })
    revalidatePath(path, 'page')
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong'
    return { error: message }
  }
}

export async function cancelSubscriptionImmediately(
  subscriptionId: string,
  path: string
): Promise<{ error?: string }> {
  try {
    await stripe.subscriptions.cancel(subscriptionId)
    revalidatePath(path, 'page')
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong'
    return { error: message }
  }
}

export async function schedulePause(
  subscriptionId: string,
  customerId: string,
  path: string,
  pauseAt: 'now' | number,
  resumeAt: number | null
): Promise<{ error?: string }> {
  try {
    const { schedule } = await retrieveOwnedSubscription(subscriptionId, customerId)

    // No key: replaces any previous (completed) pause schedule.
    const pauseSchedule: Stripe.SubscriptionScheduleCreateParams.PauseSchedule = {
      pause: {
        pause_at:
          pauseAt === 'now'
            ? { type: 'now' }
            : { type: 'timestamp', timestamp: pauseAt },
      },
      ...(resumeAt && {
        resume: { resume_at: { type: 'timestamp', timestamp: resumeAt } },
      }),
    }

    if (schedule) {
      await stripe.subscriptionSchedules.update(schedule.id, {
        pause_schedules: [pauseSchedule],
      })
    } else {
      await createPortalSchedule(subscriptionId, [pauseSchedule])
    }

    revalidatePath(path, 'page')
    return {}
  } catch (err) {
    return errorResult(err)
  }
}

export async function updateResumeDate(
  subscriptionId: string,
  customerId: string,
  path: string,
  resumeAt: number | null
): Promise<{ error?: string }> {
  try {
    const { sub, schedule } = await retrieveOwnedSubscription(subscriptionId, customerId)
    const existing = schedule?.pause_schedules?.[0]

    if (schedule && existing) {
      await stripe.subscriptionSchedules.update(schedule.id, {
        pause_schedules: [
          {
            key: existing.key,
            resume: resumeAt
              ? { resume_at: { type: 'timestamp', timestamp: resumeAt } }
              : '',
          },
        ],
      })
    } else if (sub.status === 'paused') {
      // Paused outside the portal (e.g. in the Dashboard) with no schedule.
      // Omitting `pause` tells Stripe to use the existing pause time.
      if (!resumeAt) return {}
      await createPortalSchedule(subscriptionId, [
        { resume: { resume_at: { type: 'timestamp', timestamp: resumeAt } } },
      ])
    } else {
      return { error: 'This subscription is not paused' }
    }

    revalidatePath(path, 'page')
    return {}
  } catch (err) {
    return errorResult(err)
  }
}

export async function resumeNow(
  subscriptionId: string,
  customerId: string,
  path: string
): Promise<{ error?: string; notice?: string }> {
  try {
    const { schedule } = await retrieveOwnedSubscription(subscriptionId, customerId)
    const existing = schedule?.pause_schedules?.[0]

    let status: Stripe.Subscription.Status
    if (schedule && existing) {
      const updated = await stripe.subscriptionSchedules.update(schedule.id, {
        pause_schedules: [
          { key: existing.key, resume: { resume_at: { type: 'now' } } },
        ],
      })
      const resumeStatus = updated.pause_schedules?.[0]?.resume?.status.type
      if (resumeStatus === 'succeeded' && isPortalManaged(updated)) {
        await stripe.subscriptionSchedules.release(updated.id)
      }
      status = (await stripe.subscriptions.retrieve(subscriptionId)).status
    } else {
      const resumed = await stripe.subscriptions.resume(subscriptionId, {
        payment_behavior: 'resume_on_payment_success',
        billing_cycle_anchor: { type: 'now' },
        proration_behavior: 'create_prorations',
      })
      status = resumed.status
    }

    revalidatePath(path, 'page')
    if (status === 'paused') {
      return {
        notice:
          'Your subscription will resume once the resumption invoice is paid.',
      }
    }
    return {}
  } catch (err) {
    return errorResult(err)
  }
}

export async function cancelScheduledPause(
  subscriptionId: string,
  customerId: string,
  path: string
): Promise<{ error?: string }> {
  try {
    const { schedule } = await retrieveOwnedSubscription(subscriptionId, customerId)
    if (!schedule) return { error: 'No pause is scheduled' }

    if (isPortalManaged(schedule)) {
      // Releasing drops the pause schedule and returns the subscription to normal.
      await stripe.subscriptionSchedules.release(schedule.id)
    } else {
      await stripe.subscriptionSchedules.update(schedule.id, {
        pause_schedules: '',
      })
    }

    revalidatePath(path, 'page')
    return {}
  } catch (err) {
    return errorResult(err)
  }
}

export async function createSetupIntent(
  customerId: string
): Promise<{ clientSecret: string } | { error: string }> {
  try {
    const intent = await stripe.setupIntents.create({
      customer: customerId,
      allowed_payment_method_types: ['card'],
      usage: 'off_session',
    })
    if (!intent.client_secret) {
      return { error: 'Failed to create setup intent' }
    }
    return { clientSecret: intent.client_secret }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong'
    return { error: message }
  }
}

export async function updateBillingInfo(
  customerId: string,
  path: string,
  _prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  try {
    const name = formData.get('name') as string | null
    const email = formData.get('email') as string | null
    const phone = formData.get('phone') as string | null

    const addressLine1 = formData.get('address.line1') as string | null
    const addressLine2 = formData.get('address.line2') as string | null
    const addressCity = formData.get('address.city') as string | null
    const addressState = formData.get('address.state') as string | null
    const addressPostal = formData.get('address.postal_code') as string | null
    const addressCountry = formData.get('address.country') as string | null

    const shippingName = formData.get('shipping.name') as string | null
    const shippingLine1 = formData.get('shipping.address.line1') as string | null
    const shippingLine2 = formData.get('shipping.address.line2') as string | null
    const shippingCity = formData.get('shipping.address.city') as string | null
    const shippingState = formData.get('shipping.address.state') as string | null
    const shippingPostal = formData.get('shipping.address.postal_code') as string | null
    const shippingCountry = formData.get('shipping.address.country') as string | null

    await stripe.customers.update(customerId, {
      ...(name && { name }),
      ...(email && { email }),
      ...(phone && { phone }),
      address: {
        line1: addressLine1 ?? '',
        line2: addressLine2 ?? '',
        city: addressCity ?? '',
        state: addressState ?? '',
        postal_code: addressPostal ?? '',
        country: addressCountry ?? '',
      },
      ...(shippingName && {
        shipping: {
          name: shippingName,
          address: {
            line1: shippingLine1 ?? '',
            line2: shippingLine2 ?? '',
            city: shippingCity ?? '',
            state: shippingState ?? '',
            postal_code: shippingPostal ?? '',
            country: shippingCountry ?? '',
          },
        },
      }),
    })

    revalidatePath(path, 'page')
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong'
    return { error: message }
  }
}

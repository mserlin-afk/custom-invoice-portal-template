'use server'

import { revalidatePath } from 'next/cache'
import { stripe } from '@/lib/stripe'

export async function cancelSubscriptionAtPeriodEnd(
  subscriptionId: string,
  path: string
): Promise<{ error?: string }> {
  try {
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

export async function createSetupIntent(
  customerId: string
): Promise<{ clientSecret: string } | { error: string }> {
  try {
    const intent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
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

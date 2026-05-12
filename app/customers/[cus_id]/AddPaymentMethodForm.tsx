'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { createSetupIntent } from './actions'

// Singleton — created once at module scope, never recreated on render
let stripePromise: ReturnType<typeof loadStripe> | null = null
function getStripe(publishableKey: string) {
  stripePromise ??= loadStripe(publishableKey)
  return stripePromise
}

type Props = {
  customerId: string
  path: string
  publishableKey: string
  primaryColor: string | null
}

export function AddPaymentMethodForm({
  customerId,
  path,
  publishableKey,
  primaryColor,
}: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAddClick() {
    setIsLoading(true)
    setError(null)
    const result = await createSetupIntent(customerId)
    if ('error' in result) {
      setError(result.error)
      setIsLoading(false)
      return
    }
    setClientSecret(result.clientSecret)
    setIsLoading(false)
  }

  if (!clientSecret) {
    return (
      <div>
        <button
          onClick={handleAddClick}
          disabled={isLoading}
          className="text-sm font-medium text-zinc-500 hover:text-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? 'Loading…' : '+ Add payment method'}
        </button>
        {error && (
          <p className="text-xs text-red-600 mt-2">{error}</p>
        )}
      </div>
    )
  }

  return (
    <Elements
      stripe={getStripe(publishableKey)}
      options={{
          clientSecret,
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: '#3f3f46',
            },
          },
        }}
    >
      <SetupForm
        path={path}
        onCancel={() => setClientSecret(null)}
      />
    </Elements>
  )
}

function SetupForm({
  path,
  onCancel,
}: {
  path: string
  onCancel: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // path is passed for future use (e.g. analytics) but refresh is client-side
  void path

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setIsSubmitting(true)
    setError(null)

    const result = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    })

    if (result.error) {
      setError(result.error.message ?? 'Payment method setup failed')
      setIsSubmitting(false)
      return
    }

    // Success — refresh server component data to show new card
    router.refresh()
    onCancel()
  }

  return (
    <form onSubmit={handleSubmit} className="pt-2">
      <PaymentElement />

      {error && (
        <p className="text-xs text-red-600 mt-3">{error}</p>
      )}

      <div className="flex gap-3 mt-4">
        <button
          type="submit"
          disabled={!stripe || !elements || isSubmitting}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer"
        >
          {isSubmitting ? 'Saving…' : 'Save card'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:text-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

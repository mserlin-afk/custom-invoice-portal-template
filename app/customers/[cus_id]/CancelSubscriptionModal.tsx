'use client'

import { useState, useActionState } from 'react'
import {
  cancelSubscriptionAtPeriodEnd,
  cancelSubscriptionImmediately,
} from './actions'
import { Spinner } from './Spinner'

type Props = {
  subscriptionId: string
  productName: string
  path: string
  primaryColor: string | null
}

type ActionState = { error: string | undefined }
const initialState: ActionState = { error: undefined }

export function CancelSubscriptionModal({
  subscriptionId,
  productName,
  path,
  primaryColor,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  const [atPeriodEndState, atPeriodEndAction, atPeriodEndPending] =
    useActionState(
      async (_prev: ActionState) => {
        const result = await cancelSubscriptionAtPeriodEnd(subscriptionId, path)
        if (!result.error) setIsOpen(false)
        return { error: result.error }
      },
      initialState
    )

  const [immediateState, immediateAction, immediatePending] = useActionState(
    async (_prev: ActionState) => {
      const result = await cancelSubscriptionImmediately(subscriptionId, path)
      if (!result.error) setIsOpen(false)
      return { error: result.error }
    },
    initialState
  )

  const isPending = atPeriodEndPending || immediatePending
  const error = atPeriodEndState.error ?? immediateState.error

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm text-zinc-500 hover:text-zinc-700 font-medium shrink-0 cursor-pointer"
      >
        Cancel
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => !isPending && setIsOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">
              Cancel subscription
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              Are you sure you want to cancel{' '}
              <span className="font-medium text-zinc-700">{productName}</span>?
              Choose how you&apos;d like to proceed.
            </p>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3">
              <form action={atPeriodEndAction}>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left cursor-pointer"
                >
                  {atPeriodEndPending ? (
                    <span className="flex items-center gap-2">
                      <Spinner /> Canceling at period end…
                    </span>
                  ) : (
                    <>
                      <span className="block">Cancel at end of billing period</span>
                      <span className="text-xs text-zinc-400 font-normal">
                        You keep access until the current period ends
                      </span>
                    </>
                  )}
                </button>
              </form>

              <form action={immediateAction}>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full px-4 py-2.5 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left cursor-pointer"
                >
                  {immediatePending ? (
                    <span className="flex items-center gap-2">
                      <Spinner className="text-red-500" /> Canceling…
                    </span>
                  ) : (
                    <>
                      <span className="block">Cancel immediately</span>
                      <span className="text-xs text-red-400 font-normal">
                        Access ends right away
                      </span>
                    </>
                  )}
                </button>
              </form>

              <button
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Keep subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

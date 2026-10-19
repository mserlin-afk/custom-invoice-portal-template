'use client'

import { useState, useTransition } from 'react'
import {
  cancelScheduledPause,
  resumeNow,
  updateResumeDate,
} from './actions'
import type { PauseInfo } from './SubscriptionsSection'
import { DateInput } from './PauseSubscriptionModal'
import { Spinner } from './Spinner'
import {
  addDays,
  earliestFutureDate,
  fromTimestamp,
  laterDate,
  toUtcTimestamp,
} from './pauseDates'

type Props = {
  subscriptionId: string
  customerId: string
  productName: string
  path: string
  pause: PauseInfo
}

type PendingAction = 'save' | 'remove' | 'resume' | 'unpause' | null

export function ManagePauseModal({
  subscriptionId,
  customerId,
  productName,
  path,
  pause,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [resumeDate, setResumeDate] = useState(
    pause.resumeAtTimestamp ? fromTimestamp(pause.resumeAtTimestamp) : ''
  )
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [isPending, startTransition] = useTransition()

  // Stripe won't let the resume be edited while its invoice awaits payment
  const awaitingPayment =
    pause.resumeStatus === 'pending' || pause.resumeStatus === 'requires_action'

  const minResumeDate = pause.pauseAtTimestamp
    ? laterDate(addDays(fromTimestamp(pause.pauseAtTimestamp), 1), earliestFutureDate())
    : earliestFutureDate()

  function run(
    action: Exclude<PendingAction, null>,
    fn: () => Promise<{ error?: string; notice?: string }>
  ) {
    setError(null)
    setNotice(null)
    setPendingAction(action)
    startTransition(async () => {
      const result = await fn()
      setPendingAction(null)
      if (result.error) {
        setError(result.error)
      } else if (result.notice) {
        setNotice(result.notice)
      } else {
        setIsOpen(false)
      }
    })
  }

  function saveResumeDate() {
    if (!resumeDate) {
      setError('Choose a date to resume on')
      return
    }
    if (resumeDate < minResumeDate) {
      setError('The resume date must be in the future and after the pause date')
      return
    }
    run('save', () =>
      updateResumeDate(subscriptionId, customerId, path, toUtcTimestamp(resumeDate))
    )
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm text-zinc-500 hover:text-zinc-700 font-medium shrink-0 cursor-pointer"
      >
        Manage pause
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
              Manage pause
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              <span className="font-medium text-zinc-700">{productName}</span>{' '}
              {pause.pauseScheduled
                ? `will pause on ${pause.pauseAt}`
                : `has been paused since ${pause.pauseAt}`}
              {pause.resumeAt
                ? ` and resume on ${pause.resumeAt}.`
                : ' until you resume it.'}
            </p>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
                {error}
              </p>
            )}
            {notice && (
              <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2 mb-4">
                {notice}
              </p>
            )}
            {pause.errorMessage && !error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
                {pause.errorMessage}
              </p>
            )}

            {awaitingPayment ? (
              <p className="text-sm text-zinc-600 bg-zinc-50 rounded-lg px-3 py-2 mb-4">
                Your subscription is resuming and will be active once the
                latest invoice is paid.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Resume date */}
                <div className="rounded-lg border border-zinc-200 p-3">
                  <p className="text-sm font-medium text-zinc-700">Resume date</p>
                  <div className="flex items-center gap-2">
                    <DateInput
                      value={resumeDate}
                      min={minResumeDate}
                      onChange={setResumeDate}
                      label="Resume date"
                    />
                    <button
                      onClick={saveResumeDate}
                      disabled={isPending}
                      className="mt-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 cursor-pointer"
                      style={{ backgroundColor: 'var(--brand-primary)' }}
                    >
                      {pendingAction === 'save' ? <Spinner /> : 'Save'}
                    </button>
                  </div>
                  {pause.resumeAt && (
                    <button
                      onClick={() =>
                        run('remove', () =>
                          updateResumeDate(subscriptionId, customerId, path, null)
                        )
                      }
                      disabled={isPending}
                      className="mt-2 ml-6 text-xs text-zinc-500 hover:text-zinc-700 disabled:opacity-50 cursor-pointer"
                    >
                      {pendingAction === 'remove'
                        ? 'Removing…'
                        : 'Remove resume date (stay paused until I resume)'}
                    </button>
                  )}
                </div>

                {!pause.pauseScheduled && (
                  <ActionButton
                    onClick={() =>
                      run('resume', () => resumeNow(subscriptionId, customerId, path))
                    }
                    disabled={isPending}
                    pending={pendingAction === 'resume'}
                    pendingLabel="Resuming…"
                    label="Resume now"
                    description="Service and billing restart today"
                  />
                )}

                {pause.pauseScheduled && (
                  <ActionButton
                    onClick={() =>
                      run('unpause', () =>
                        cancelScheduledPause(subscriptionId, customerId, path)
                      )
                    }
                    disabled={isPending}
                    pending={pendingAction === 'unpause'}
                    pendingLabel="Canceling pause…"
                    label="Don't pause"
                    description="Cancel the scheduled pause and keep your subscription active"
                  />
                )}
              </div>
            )}

            <button
              onClick={() => setIsOpen(false)}
              disabled={isPending}
              className="w-full mt-3 px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function ActionButton({
  onClick,
  disabled,
  pending,
  pendingLabel,
  label,
  description,
}: {
  onClick: () => void
  disabled: boolean
  pending: boolean
  pendingLabel: string
  label: string
  description: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left cursor-pointer"
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <Spinner /> {pendingLabel}
        </span>
      ) : (
        <>
          <span className="block">{label}</span>
          <span className="text-xs text-zinc-400 font-normal">{description}</span>
        </>
      )}
    </button>
  )
}

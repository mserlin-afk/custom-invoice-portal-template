'use client'

import { useState, useActionState, startTransition } from 'react'
import { schedulePause } from './actions'
import { Spinner } from './Spinner'
import {
  addDays,
  earliestFutureDate,
  laterDate,
  toUtcTimestamp,
  todayUtc,
} from './pauseDates'

type Props = {
  subscriptionId: string
  customerId: string
  productName: string
  path: string
}

type ActionState = { error: string | undefined }
const initialState: ActionState = { error: undefined }

export function PauseSubscriptionModal({
  subscriptionId,
  customerId,
  productName,
  path,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [pauseMode, setPauseMode] = useState<'now' | 'date'>('now')
  const [pauseDate, setPauseDate] = useState('')
  const [resumeMode, setResumeMode] = useState<'manual' | 'date'>('manual')
  const [resumeDate, setResumeDate] = useState('')

  // Resume must be strictly after the pause (and in the future)
  const pauseDay = pauseMode === 'date' && pauseDate ? pauseDate : todayUtc()
  const minResumeDate = laterDate(addDays(pauseDay, 1), earliestFutureDate())

  const [state, submitAction, isPending] = useActionState(
    async (_prev: ActionState): Promise<ActionState> => {
      if (pauseMode === 'date' && !pauseDate) {
        return { error: 'Choose a date to pause on' }
      }
      if (pauseMode === 'date' && pauseDate < earliestFutureDate()) {
        return { error: 'The pause date must be in the future' }
      }
      if (resumeMode === 'date' && !resumeDate) {
        return { error: 'Choose a date to resume on' }
      }
      if (resumeMode === 'date' && resumeDate < minResumeDate) {
        return { error: 'The resume date must be after the pause date' }
      }
      const result = await schedulePause(
        subscriptionId,
        customerId,
        path,
        pauseMode === 'now' ? 'now' : toUtcTimestamp(pauseDate),
        resumeMode === 'date' ? toUtcTimestamp(resumeDate) : null
      )
      if (!result.error) setIsOpen(false)
      return { error: result.error }
    },
    initialState
  )

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm text-zinc-500 hover:text-zinc-700 font-medium shrink-0 cursor-pointer"
      >
        Pause
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
          {/* onSubmit (not `action`) so React doesn't auto-reset the form, which
              desyncs the controlled radio buttons from state */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              startTransition(() => submitAction())
            }}
            className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6"
          >
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">
              Pause subscription
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              While{' '}
              <span className="font-medium text-zinc-700">{productName}</span>{' '}
              is paused, your service stops and you won&apos;t be invoiced.
              You&apos;ll be credited for unused time in the current period.
            </p>

            {state.error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
                {state.error}
              </p>
            )}

            <fieldset className="mb-5" disabled={isPending}>
              <legend className="text-sm font-medium text-zinc-700 mb-2">
                Pause starting
              </legend>
              <RadioOption
                name="pauseMode"
                checked={pauseMode === 'now'}
                onChange={() => setPauseMode('now')}
                label="Immediately"
              />
              <RadioOption
                name="pauseMode"
                checked={pauseMode === 'date'}
                onChange={() => setPauseMode('date')}
                label="On a specific date"
              />
              {pauseMode === 'date' && (
                <DateInput
                  value={pauseDate}
                  min={earliestFutureDate()}
                  onChange={setPauseDate}
                  label="Pause date"
                />
              )}
            </fieldset>

            <fieldset className="mb-6" disabled={isPending}>
              <legend className="text-sm font-medium text-zinc-700 mb-2">
                Resume
              </legend>
              <RadioOption
                name="resumeMode"
                checked={resumeMode === 'manual'}
                onChange={() => setResumeMode('manual')}
                label="When I choose to resume"
              />
              <RadioOption
                name="resumeMode"
                checked={resumeMode === 'date'}
                onChange={() => setResumeMode('date')}
                label="On a specific date"
              />
              {resumeMode === 'date' && (
                <DateInput
                  value={resumeDate}
                  min={minResumeDate}
                  onChange={setResumeDate}
                  label="Resume date"
                />
              )}
            </fieldset>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner /> Pausing…
                  </span>
                ) : pauseMode === 'now' ? (
                  'Pause now'
                ) : (
                  'Schedule pause'
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Keep subscription active
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

export function RadioOption({
  name,
  checked,
  onChange,
  label,
}: {
  name: string
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-600 py-1 cursor-pointer">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="cursor-pointer"
      />
      {label}
    </label>
  )
}

export function DateInput({
  value,
  min,
  onChange,
  label,
}: {
  value: string
  min: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <input
      type="date"
      aria-label={label}
      value={value}
      min={min}
      onChange={(e) => onChange(e.target.value)}
      className="mt-2 ml-6 px-3 py-1.5 rounded-lg border border-zinc-200 text-sm text-zinc-700"
    />
  )
}

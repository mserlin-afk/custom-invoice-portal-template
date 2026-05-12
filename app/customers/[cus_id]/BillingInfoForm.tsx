'use client'

import { useActionState, useState } from 'react'
import { updateBillingInfo } from './actions'

export type BillingInfoData = {
  name: string
  email: string
  phone: string
  address: {
    line1: string
    line2: string
    city: string
    state: string
    postal_code: string
    country: string
  }
  shipping: {
    name: string
    address: {
      line1: string
      line2: string
      city: string
      state: string
      postal_code: string
      country: string
    }
  } | null
}

type Props = {
  customerId: string
  path: string
  initial: BillingInfoData
  primaryColor: string | null
}

type ActionState = { error: string | undefined }
const initialState: ActionState = { error: undefined }

export function BillingInfoForm({ customerId, path, initial, primaryColor }: Props) {
  const [isEditing, setIsEditing] = useState(false)

  const [state, formAction, isPending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await updateBillingInfo(customerId, path, prev, formData)
      if (!result.error) setIsEditing(false)
      return { error: result.error }
    },
    initialState
  )

  if (!isEditing) {
    return (
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
          <InfoBlock label="Name" value={initial.name} />
          <InfoBlock label="Email" value={initial.email} />
          {initial.phone && <InfoBlock label="Phone" value={initial.phone} />}
          <div className="sm:col-span-2">
            <InfoBlock
              label="Billing address"
              value={formatAddress(initial.address)}
            />
          </div>
          {initial.shipping && (
            <div className="sm:col-span-2">
              <InfoBlock
                label="Shipping address"
                value={`${initial.shipping.name}\n${formatAddress(initial.shipping.address)}`}
              />
            </div>
          )}
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="mt-4 text-sm font-medium text-zinc-500 hover:text-zinc-700 cursor-pointer"
        >
          Edit
        </button>
      </div>
    )
  }

  return (
    <form action={formAction}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name" name="name" defaultValue={initial.name} />
        <Field label="Email" name="email" type="email" defaultValue={initial.email} />
        <Field label="Phone" name="phone" defaultValue={initial.phone} />

        <div className="sm:col-span-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3 mt-2">
            Billing address
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Address line 1"
              name="address.line1"
              defaultValue={initial.address.line1}
              className="sm:col-span-2"
            />
            <Field
              label="Address line 2"
              name="address.line2"
              defaultValue={initial.address.line2}
              className="sm:col-span-2"
            />
            <Field label="City" name="address.city" defaultValue={initial.address.city} />
            <Field label="State / Province" name="address.state" defaultValue={initial.address.state} />
            <Field label="Postal code" name="address.postal_code" defaultValue={initial.address.postal_code} />
            <Field label="Country" name="address.country" defaultValue={initial.address.country} placeholder="US" />
          </div>
        </div>

        <div className="sm:col-span-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3 mt-2">
            Shipping address
            <span className="text-zinc-400 font-normal normal-case tracking-normal ml-1">
              (optional)
            </span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Recipient name"
              name="shipping.name"
              defaultValue={initial.shipping?.name ?? ''}
              className="sm:col-span-2"
            />
            <Field
              label="Address line 1"
              name="shipping.address.line1"
              defaultValue={initial.shipping?.address.line1 ?? ''}
              className="sm:col-span-2"
            />
            <Field
              label="Address line 2"
              name="shipping.address.line2"
              defaultValue={initial.shipping?.address.line2 ?? ''}
              className="sm:col-span-2"
            />
            <Field label="City" name="shipping.address.city" defaultValue={initial.shipping?.address.city ?? ''} />
            <Field label="State / Province" name="shipping.address.state" defaultValue={initial.shipping?.address.state ?? ''} />
            <Field label="Postal code" name="shipping.address.postal_code" defaultValue={initial.shipping?.address.postal_code ?? ''} />
            <Field label="Country" name="shipping.address.country" defaultValue={initial.shipping?.address.country ?? ''} placeholder="US" />
          </div>
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-4">
          {state.error}
        </p>
      )}

      <div className="flex gap-3 mt-6">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:text-zinc-800 disabled:opacity-50 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// --- Sub-components ---

function InfoBlock({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium text-zinc-400 mb-0.5">{label}</p>
      <p className="text-sm text-zinc-800 whitespace-pre-line">{value}</p>
    </div>
  )
}

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
  placeholder,
  className = '',
}: {
  label: string
  name: string
  defaultValue: string
  type?: string
  placeholder?: string
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-zinc-500 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-300 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-transparent"
        style={{ '--tw-ring-color': '#71717a' } as React.CSSProperties}
      />
    </div>
  )
}

function formatAddress(addr: BillingInfoData['address']): string {
  const parts = [
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.postal_code].filter(Boolean).join(', '),
    addr.country,
  ].filter(Boolean)
  return parts.join('\n')
}

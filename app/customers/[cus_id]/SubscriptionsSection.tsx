import { CancelSubscriptionModal } from './CancelSubscriptionModal'

export type SubscriptionRow = {
  id: string
  productName: string
  status: string
  formattedAmount: string
  nextBillingDate: string
  cancelAtPeriodEnd: boolean
  path: string
  primaryColor: string | null
}

function subscriptionStatusBadge(
  status: string,
  cancelAtPeriodEnd: boolean
): { label: string; classes: string } {
  if (cancelAtPeriodEnd) {
    return { label: 'Canceling', classes: 'bg-orange-100 text-orange-700' }
  }
  switch (status) {
    case 'active':
      return { label: 'Active', classes: 'bg-green-100 text-green-800' }
    case 'trialing':
      return { label: 'Trial', classes: 'bg-blue-100 text-blue-800' }
    case 'past_due':
      return { label: 'Past due', classes: 'bg-red-100 text-red-700' }
    case 'unpaid':
      return { label: 'Unpaid', classes: 'bg-red-100 text-red-700' }
    case 'canceled':
      return { label: 'Canceled', classes: 'bg-zinc-100 text-zinc-500' }
    case 'paused':
      return { label: 'Paused', classes: 'bg-yellow-100 text-yellow-700' }
    default:
      return { label: status, classes: 'bg-zinc-100 text-zinc-500' }
  }
}

const ACTIONABLE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid'])

export function SubscriptionsSection({
  subscriptions,
}: {
  subscriptions: SubscriptionRow[]
}) {
  if (subscriptions.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm" style={{ borderTop: '2px solid var(--brand-accent)' }}>
      <div className="px-6 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-semibold text-zinc-700">
          {subscriptions.length === 1 ? 'Subscription' : 'Subscriptions'}
        </h2>
      </div>

      <div className="divide-y divide-zinc-100">
        {subscriptions.map((sub) => {
          const badge = subscriptionStatusBadge(sub.status, sub.cancelAtPeriodEnd)
          const isActionable = ACTIONABLE_STATUSES.has(sub.status) && !sub.cancelAtPeriodEnd

          return (
            <div key={sub.id} className="px-6 py-5 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-zinc-900">{sub.productName}</span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.classes}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <p className="text-sm text-zinc-500">{sub.formattedAmount}</p>
                <p className="text-xs text-zinc-400 mt-1">
                  {sub.cancelAtPeriodEnd
                    ? `Cancels on ${sub.nextBillingDate}`
                    : `Next billing on ${sub.nextBillingDate}`}
                </p>
              </div>

              {isActionable && (
                <CancelSubscriptionModal
                  subscriptionId={sub.id}
                  productName={sub.productName}
                  path={sub.path}
                  primaryColor={sub.primaryColor}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

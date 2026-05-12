import { AddPaymentMethodForm } from './AddPaymentMethodForm'

export type PaymentMethodData = {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

function CardBrandIcon({ brand }: { brand: string }) {
  return (
    <span className="inline-flex items-center justify-center w-10 h-7 rounded border border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600 uppercase">
      {brand.slice(0, 4)}
    </span>
  )
}

export function PaymentMethodsSection({
  paymentMethods,
  customerId,
  path,
  publishableKey,
  primaryColor,
}: {
  paymentMethods: PaymentMethodData[]
  customerId: string
  path: string
  publishableKey: string
  primaryColor: string | null
}) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm" style={{ borderTop: '2px solid var(--brand-accent)' }}>
      <div className="px-6 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-semibold text-zinc-700">Payment methods</h2>
      </div>

      <div className="divide-y divide-zinc-100">
        {paymentMethods.length === 0 ? (
          <p className="px-6 py-5 text-sm text-zinc-400">No payment methods on file.</p>
        ) : (
          paymentMethods.map((pm) => (
            <div key={pm.id} className="px-6 py-4 flex items-center gap-4">
              <CardBrandIcon brand={pm.brand} />
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  •••• {pm.last4}
                </p>
                <p className="text-xs text-zinc-400">
                  Expires {String(pm.expMonth).padStart(2, '0')}/{pm.expYear}
                </p>
              </div>
            </div>
          ))
        )}

        <div className="px-6 py-4">
          <AddPaymentMethodForm
            customerId={customerId}
            path={path}
            publishableKey={publishableKey}
            primaryColor={primaryColor}
          />
        </div>
      </div>
    </div>
  )
}

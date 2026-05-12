import { BillingInfoForm, type BillingInfoData } from './BillingInfoForm'

export function BillingInfoSection({
  billingInfo,
  customerId,
  path,
  primaryColor,
}: {
  billingInfo: BillingInfoData
  customerId: string
  path: string
  primaryColor: string | null
}) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm" style={{ borderTop: '2px solid var(--brand-accent)' }}>
      <div className="px-6 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-semibold text-zinc-700">Billing & shipping</h2>
      </div>
      <div className="px-6 py-5">
        <BillingInfoForm
          customerId={customerId}
          path={path}
          initial={billingInfo}
          primaryColor={primaryColor}
        />
      </div>
    </div>
  )
}

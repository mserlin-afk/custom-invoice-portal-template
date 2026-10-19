import { notFound } from "next/navigation";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import {
  SubscriptionsSection,
  type PauseInfo,
  type SubscriptionRow,
} from "./SubscriptionsSection";
import { PaymentMethodsSection, type PaymentMethodData } from "./PaymentMethodsSection";
import { BillingInfoSection } from "./BillingInfoSection";
import type { BillingInfoData } from "./BillingInfoForm";

// --- Helpers ---

function formatAmount(amount: number | null, currency: string): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return "—";
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function statusBadge(
  status: Stripe.Invoice["status"]
): { label: string; classes: string } {
  switch (status) {
    case "paid":
      return { label: "Paid", classes: "bg-green-100 text-green-800" };
    case "open":
      return { label: "Open", classes: "bg-blue-100 text-blue-800" };
    case "void":
      return { label: "Void", classes: "bg-zinc-100 text-zinc-500" };
    case "uncollectible":
      return { label: "Uncollectible", classes: "bg-red-100 text-red-700" };
    case "draft":
      return { label: "Draft", classes: "bg-yellow-100 text-yellow-700" };
    default:
      return {
        label: status ?? "Unknown",
        classes: "bg-zinc-100 text-zinc-500",
      };
  }
}

function formatSubscriptionAmount(sub: Stripe.Subscription): string {
  const item = sub.items.data[0];
  if (!item?.price) return "—";

  const price = item.price;
  const amount = formatAmount(price.unit_amount, price.currency);
  const interval = price.recurring
    ? `/ ${price.recurring.interval}`
    : "";
  return `${amount} ${interval}`.trim();
}

function getProductName(
  sub: Stripe.Subscription,
  productMap: Map<string, string>
): string {
  const item = sub.items.data[0];
  if (!item?.price) return "Subscription";
  // price.product is a string ID — can't expand it (would exceed Stripe's 4-level limit),
  // so we batch-fetch products separately and look up by ID here.
  const productId =
    typeof item.price.product === "string" ? item.price.product : null;
  if (productId && productMap.has(productId)) {
    return productMap.get(productId)!;
  }
  return item.price.nickname ?? "Subscription";
}

function getActivePauseSchedule(
  sub: Stripe.Subscription
): Stripe.SubscriptionSchedule.PauseSchedule | null {
  const schedule = sub.schedule as Stripe.SubscriptionSchedule | null;
  const pauseSchedule = schedule?.pause_schedules?.[0];
  if (!pauseSchedule) return null;
  // A pause that already ran its course doesn't need managing anymore
  const done =
    pauseSchedule.pause.status.type === "succeeded" &&
    pauseSchedule.resume?.status.type === "succeeded";
  return done ? null : pauseSchedule;
}

function buildPauseInfo(sub: Stripe.Subscription): PauseInfo | null {
  const pauseSchedule = getActivePauseSchedule(sub);
  if (!pauseSchedule) {
    // Paused without a schedule (e.g. from the Dashboard): no resume date yet
    return sub.status === "paused"
      ? {
          pauseScheduled: false,
          pauseAt: formatDate(sub.status_details?.paused?.transitioned_at),
          pauseAtTimestamp: sub.status_details?.paused?.transitioned_at ?? null,
          resumeAt: null,
          resumeAtTimestamp: null,
          resumeStatus: null,
          errorMessage: null,
        }
      : null;
  }
  const { pause, resume } = pauseSchedule;
  return {
    pauseScheduled: pause.status.type === "scheduled",
    pauseAt: formatDate(pause.pause_at),
    pauseAtTimestamp: pause.pause_at,
    resumeAt: resume ? formatDate(resume.resume_at) : null,
    resumeAtTimestamp: resume?.resume_at ?? null,
    resumeStatus: resume?.status.type ?? null,
    errorMessage:
      pause.status.error?.message ?? resume?.status.error?.message ?? null,
  };
}

// Mirrors Stripe's documented conditions for pausing a subscription
function canPause(sub: Stripe.Subscription): boolean {
  const now = Math.floor(Date.now() / 1000);
  return (
    (sub.status === "active" || sub.status === "past_due") &&
    sub.collection_method === "charge_automatically" &&
    sub.billing_mode.type === "flexible" &&
    !(sub.trial_end && sub.trial_end > now) &&
    !sub.cancel_at_period_end &&
    !sub.cancel_at &&
    getActivePauseSchedule(sub) === null
  );
}

// --- Page ---

type Props = {
  params: Promise<{ cus_id: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { cus_id } = await params;
  return { title: `Invoices — ${cus_id}` };
}

export default async function CustomerInvoicesPage({ params }: Props) {
  const { cus_id } = await params;
  const path = `/customers/${cus_id}`;

  const [
    customerResult,
    invoiceResult,
    accountResult,
    subscriptionResult,
    paymentMethodResult,
  ] = await Promise.allSettled([
    stripe.customers.retrieve(cus_id),
    stripe.invoices.list({ customer: cus_id, limit: 100 }),
    stripe.accounts.retrieve(null),
    stripe.subscriptions.list({
      customer: cus_id,
      status: "all",
      limit: 20,
      // Pause schedules live on the subscription schedule
      expand: ["data.schedule"],
    }),
    stripe.paymentMethods.list({ customer: cus_id, limit: 20 }),
  ]);

  // Customer is required
  if (customerResult.status === "rejected") {
    if (
      customerResult.reason instanceof Stripe.errors.StripeInvalidRequestError
    ) {
      notFound();
    }
    throw customerResult.reason;
  }
  if ((customerResult.value as Stripe.DeletedCustomer).deleted) notFound();
  const customer = customerResult.value as Stripe.Customer;

  // Invoices are required
  if (invoiceResult.status === "rejected") throw invoiceResult.reason;
  const invoices = invoiceResult.value.data;

  // Subscriptions are required
  if (subscriptionResult.status === "rejected") throw subscriptionResult.reason;
  const subscriptions = subscriptionResult.value.data;

  // Batch-fetch product names for all subscription items (product IDs are not expandable
  // within the subscriptions list without exceeding Stripe's 4-level expansion limit)
  const productIds = [
    ...new Set(
      subscriptions
        .flatMap((sub) => sub.items.data)
        .map((item) =>
          typeof item.price?.product === "string" ? item.price.product : null
        )
        .filter((id): id is string => id !== null)
    ),
  ];
  const productMap = new Map<string, string>();
  if (productIds.length > 0) {
    const productResults = await Promise.allSettled(
      productIds.map((id) => stripe.products.retrieve(id))
    );
    productResults.forEach((result, i) => {
      if (result.status === "fulfilled") {
        productMap.set(productIds[i], result.value.name);
      }
    });
  }

  // Payment methods are required
  if (paymentMethodResult.status === "rejected") throw paymentMethodResult.reason;
  const paymentMethods = paymentMethodResult.value.data;

  // Branding — best-effort, never fails the page
  let primaryColor: string | null = null;
  let secondaryColor: string | null = null;
  let logoUrl: string | null = null;

  let companyName: string | null = null;

  if (accountResult.status === "fulfilled") {
    companyName =
      accountResult.value.business_profile?.name ??
      accountResult.value.settings?.dashboard?.display_name ??
      null;
    const branding = accountResult.value.settings?.branding;
    primaryColor = branding?.primary_color ?? null;
    secondaryColor = branding?.secondary_color ?? null;

    const logoField = branding?.logo;
    const logoId =
      typeof logoField === "string"
        ? logoField
        : (logoField as Stripe.File | null)?.id ?? null;

    if (logoId) {
      try {
        const link = await stripe.fileLinks.create({ file: logoId });
        logoUrl = link.url;
      } catch {
        // Logo unavailable — header falls back to text
      }
    }
  }

  // --- Serialize data for client components ---

  const subscriptionRows: SubscriptionRow[] = subscriptions.map((sub) => ({
    id: sub.id,
    productName: getProductName(sub, productMap),
    status: sub.status,
    formattedAmount: formatSubscriptionAmount(sub),
    nextBillingDate: formatDate(sub.items.data[0]?.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canPause: canPause(sub),
    pause: buildPauseInfo(sub),
    customerId: cus_id,
    path,
    primaryColor,
  }));

  const paymentMethodData: PaymentMethodData[] = paymentMethods
    .filter((pm): pm is Stripe.PaymentMethod & { card: NonNullable<Stripe.PaymentMethod["card"]> } => pm.card != null)
    .map((pm) => ({
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    }));

  const billingInfo: BillingInfoData = {
    name: customer.name ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    address: {
      line1: customer.address?.line1 ?? "",
      line2: customer.address?.line2 ?? "",
      city: customer.address?.city ?? "",
      state: customer.address?.state ?? "",
      postal_code: customer.address?.postal_code ?? "",
      country: customer.address?.country ?? "",
    },
    shipping: customer.shipping
      ? {
          name: customer.shipping.name ?? "",
          address: {
            line1: customer.shipping.address?.line1 ?? "",
            line2: customer.shipping.address?.line2 ?? "",
            city: customer.shipping.address?.city ?? "",
            state: customer.shipping.address?.state ?? "",
            postal_code: customer.shipping.address?.postal_code ?? "",
            country: customer.shipping.address?.country ?? "",
          },
        }
      : null,
  };

  return (
    <div
      className="min-h-screen font-sans"
      style={{
        '--brand-primary': primaryColor ?? '#4f46e5',
        '--brand-accent': secondaryColor ?? primaryColor ?? '#4f46e5',
        backgroundColor: 'color-mix(in srgb, var(--brand-primary) 6%, white)',
      } as React.CSSProperties}
    >
      {/* Header — top accent border uses brand primary color if available */}
      <header
        className="bg-white border-b border-zinc-200"
        style={
          primaryColor
            ? { borderTop: `3px solid ${primaryColor}` }
            : undefined
        }
      >
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-400 mb-1">
              {companyName ? `${companyName} Customer Portal` : "Customer Portal"}
            </p>
            <h1 className="text-2xl font-semibold text-zinc-900">
              {customer.name ?? customer.email ?? cus_id}
            </h1>
            {customer.email && customer.name && (
              <p className="text-sm text-zinc-500 mt-0.5">{customer.email}</p>
            )}
          </div>
          {/* Brand logo or fallback text */}
          <div className="text-right">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Company logo"
                className="h-8 object-contain"
              />
            ) : (
              <span
                className="text-sm font-medium"
                style={
                  primaryColor
                    ? { color: primaryColor }
                    : { color: "#a1a1aa" }
                }
              >
                Your Company
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        {/* Subscriptions */}
        <SubscriptionsSection subscriptions={subscriptionRows} />

        {/* Payment methods */}
        <PaymentMethodsSection
          paymentMethods={paymentMethodData}
          customerId={cus_id}
          path={path}
          publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
          primaryColor={primaryColor}
        />

        {/* Billing & shipping */}
        <BillingInfoSection
          billingInfo={billingInfo}
          customerId={cus_id}
          path={path}
          primaryColor={primaryColor}
        />

        {/* Invoices */}
        {invoices.length === 0 ? (
          <div className="text-center py-20 text-zinc-400">
            No invoices found for this customer.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm" style={{ borderTop: '2px solid var(--brand-accent)' }}>
            <div className="px-6 py-4 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-700">
                {invoices.length} Invoice{invoices.length !== 1 ? "s" : ""}
              </h2>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 text-zinc-500 text-xs font-medium uppercase tracking-wide">
                  <th className="text-left px-6 py-3">Invoice</th>
                  <th className="text-left px-6 py-3">Billing Period</th>
                  <th className="text-left px-6 py-3">Amount</th>
                  <th className="text-left px-6 py-3">Status</th>
                  <th className="text-right px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {invoices.map((invoice) => {
                  const badge = statusBadge(invoice.status);
                  return (
                    <tr
                      key={invoice.id}
                      className="hover:bg-zinc-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="font-medium text-zinc-900">
                          {invoice.number ?? invoice.id}
                        </span>
                        <span className="block text-xs text-zinc-400 mt-0.5">
                          {formatDate(invoice.created)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-zinc-600">
                        {formatDate(invoice.period_start)} –{" "}
                        {formatDate(invoice.period_end)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-zinc-900">
                          {formatAmount(invoice.amount_due, invoice.currency)}
                        </span>
                        {invoice.amount_paid !== invoice.amount_due && (
                          <span className="block text-xs text-zinc-400 mt-0.5">
                            Paid:{" "}
                            {formatAmount(
                              invoice.amount_paid,
                              invoice.currency
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.classes}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {invoice.hosted_invoice_url && (
                            <a
                              href={invoice.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-zinc-500 hover:text-zinc-700 cursor-pointer"
                            >
                              View
                            </a>
                          )}
                          {invoice.invoice_pdf && (
                            <a
                              href={invoice.invoice_pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-zinc-500 hover:text-zinc-700 cursor-pointer"
                            >
                              PDF
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

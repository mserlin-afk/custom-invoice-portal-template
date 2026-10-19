// Customers pick calendar days; we send them to Stripe as 00:00 UTC, which matches
// how the page formats dates (in UTC). Date strings are `YYYY-MM-DD` (date input format).

export function toUtcTimestamp(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / 1000
}

export function fromTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  return fromTimestamp(toUtcTimestamp(date) + days * 86400)
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

// Future pause/resume dates must be strictly in the future, so the earliest pick is tomorrow
export function earliestFutureDate(): string {
  return addDays(todayUtc(), 1)
}

export function laterDate(a: string, b: string): string {
  return a > b ? a : b
}

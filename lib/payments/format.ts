/** Formats an amount in paise as Indian rupees, e.g. 1500000 → "₹15,000.00". Safe in client components. */
export function formatInr(amountPaise: number): string {
  return `₹${(amountPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

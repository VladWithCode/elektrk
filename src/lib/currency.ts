export const LOCALE = "es-MX";
export const CURRENCY = "MXN";

const formatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
});

export function formatCurrency(amount: number): string {
  return formatter.format(amount);
}

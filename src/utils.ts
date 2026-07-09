import type { CurrencyDesc } from "./types";

/**
 * Currency flag emoji map for common currencies
 */
const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", EGP: "🇪🇬",
  CAD: "🇨🇦", AUD: "🇦🇺", CHF: "🇨🇭", PLN: "🇵🇱",
  JPY: "🇯🇵", CNY: "🇨🇳", INR: "🇮🇳", BRL: "🇧🇷",
  MXN: "🇲🇽", KRW: "🇰🇷", SGD: "🇸🇬", HKD: "🇭🇰",
  NOK: "🇳🇴", SEK: "🇸🇪", DKK: "🇩🇰", NZD: "🇳🇿",
  SAR: "🇸🇦", AED: "🇦🇪", TRY: "🇹🇷", ZAR: "🇿🇦",
};

export function getCurrencyFlag(code: string): string {
  return CURRENCY_FLAGS[code] ?? "🏳️";
}

/**
 * Fetch all currencies from multiple APIs with fallback.
 * Returns { USD: { code: "USD", description: "United States Dollar" }, ... }
 */
export async function fetchAllCurrencies(): Promise<Record<string, CurrencyDesc>> {
  const apis = [
    {
      // Bug fix: openexchangerates returns { "USD": "United States Dollar", ... } directly
      url: "https://openexchangerates.org/api/currencies.json",
      parse: (d: unknown) => {
        const data = d as Record<string, string>;
        return Object.fromEntries(
          Object.entries(data).map(([code, desc]) => [
            code,
            { code, description: desc },
          ])
        );
      },
    },
    {
      // Bug fix: fxratesapi /symbols returns { "USD": { "name": "...", "symbol": "$" }, ... }
      // NOT { symbols: { ... } } — the original parse was wrong
      url: "https://api.fxratesapi.com/symbols",
      parse: (d: unknown) => {
        // Handle both possible response shapes
        const raw = d as Record<string, unknown>;
        // If response has a top-level "symbols" key, unwrap it; otherwise treat as-is
        const entries = raw["symbols"]
          ? Object.entries(raw["symbols"] as Record<string, unknown>)
          : Object.entries(raw);

        return Object.fromEntries(
          entries.map(([code, val]) => {
            const desc =
              typeof val === "string"
                ? val
                : typeof val === "object" && val !== null && "name" in val
                ? String((val as Record<string, unknown>)["name"])
                : code;
            return [code, { code, description: desc }];
          })
        );
      },
    },
  ];

  let lastErr: unknown;
  for (const api of apis) {
    try {
      const res = await fetch(api.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = api.parse(json);
      if (Object.keys(data).length) return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Unable to fetch currency symbols");
}

export function formatCurrency(amount: number, code: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  } catch {
    return `${amount.toFixed(4)} ${code}`;
  }
}

/**
 * Bug fix: Use dynamic decimal places based on rate magnitude
 * Small rates (like EGP) need more decimals to be meaningful
 */
export function formatExchangeRate(rate: number): string {
  if (rate >= 100) return rate.toFixed(2);
  if (rate >= 1) return rate.toFixed(4);
  return rate.toFixed(6);
}

export const formatTimestamp = (t: number): string =>
  new Date(t * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function debounce<F extends (...args: never[]) => void>(
  fn: F,
  delay: number
): (...args: Parameters<F>) => void {
  let id: ReturnType<typeof setTimeout>;
  return (...args: Parameters<F>) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), delay);
  };
}

export function validateAmount(value: string): { isValid: true } | { isValid: false; error: string } {
  const trimmed = value.trim();
  if (trimmed === "") return { isValid: false, error: "Please enter an amount" };
  const n = Number(trimmed);
  if (isNaN(n)) return { isValid: false, error: "Please enter a valid number" };
  if (n <= 0) return { isValid: false, error: "Amount must be greater than 0" };
  if (n > 1e15) return { isValid: false, error: "Amount is too large" };
  return { isValid: true };
}

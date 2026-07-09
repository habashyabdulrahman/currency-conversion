import type { CurrencyDesc } from "./types";
export declare function getCurrencyFlag(code: string): string;
/**
 * Fetch all currencies from multiple APIs with fallback.
 * Returns { USD: { code: "USD", description: "United States Dollar" }, ... }
 */
export declare function fetchAllCurrencies(): Promise<Record<string, CurrencyDesc>>;
export declare function formatCurrency(amount: number, code: string): string;
/**
 * Bug fix: Use dynamic decimal places based on rate magnitude
 * Small rates (like EGP) need more decimals to be meaningful
 */
export declare function formatExchangeRate(rate: number): string;
export declare const formatTimestamp: (t: number) => string;
export declare function debounce<F extends (...args: never[]) => void>(fn: F, delay: number): (...args: Parameters<F>) => void;
export declare function validateAmount(value: string): {
    isValid: true;
} | {
    isValid: false;
    error: string;
};

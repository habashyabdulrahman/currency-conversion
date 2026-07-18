import type { CurrencyDesc, GoldKarat, GoldPriceBreakdown, GoldSpotResponse } from "./types.js";
export declare function getCurrencyFlag(code: string): string;
/**
 * Fetches the complete currency list dynamically, with a second provider as fallback.
 * The app can still filter that list through `allowedCurrencies` in its config.
 */
export declare function fetchAllCurrencies(timeoutMs?: number): Promise<Record<string, CurrencyDesc>>;
export declare function parseGoldSpotResponse(data: unknown, fallbackTimestamp?: number): GoldSpotResponse;
export declare const TROY_OUNCE_GRAMS = 31.1034768;
export declare function calculateGoldPrices(pricePerOunce: number): GoldPriceBreakdown;
export declare function validateGoldWeight(value: string): {
    isValid: true;
    grams: number;
} | {
    isValid: false;
    error: string;
};
export declare function calculateGoldValue(prices: GoldPriceBreakdown, karat: GoldKarat, grams: number): number;
export declare function formatCurrency(amount: number, code: string): string;
export declare function formatExchangeRate(rate: number): string;
export declare const formatTimestamp: (timestamp: number) => string;
export declare function debounce<TArgs extends unknown[]>(callback: (...args: TArgs) => void, delay: number): (...args: TArgs) => void;
export declare function validateAmount(value: string): {
    isValid: true;
} | {
    isValid: false;
    error: string;
};
export declare function copyText(text: string): Promise<void>;

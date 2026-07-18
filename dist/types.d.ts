export interface ExchangeRateResponse {
    rates: Record<string, number>;
    timestamp: number;
}
export interface RateCacheEntry {
    data: ExchangeRateResponse;
    fetchedAt: number;
}
export interface ConversionResult {
    fromAmount: number;
    fromCurrency: string;
    toAmount: number;
    toCurrency: string;
    exchangeRate: number;
    timestamp: number;
}
export interface GoldSpotResponse {
    priceUsdPerOunce: number;
    timestamp: number;
}
export interface GoldCacheEntry {
    data: GoldSpotResponse;
    fetchedAt: number;
}
export interface GoldPriceBreakdown {
    gram24: number;
    gram21: number;
}
export interface GoldPriceResult extends GoldPriceBreakdown {
    currency: string;
    goldTimestamp: number;
    exchangeRateTimestamp: number;
}
export type GoldKarat = 21 | 24;
export interface CurrencyConverterConfig {
    baseUrl: string;
    goldApiUrl: string;
    defaultCurrencies: {
        from: string;
        to: string;
    };
    defaultGoldCurrency: string;
    allowedCurrencies?: string[];
    cacheTtlSeconds: number;
    goldCacheTtlSeconds: number;
    requestTimeoutMs: number;
}
export interface CurrencyDesc {
    code: string;
    description: string;
}

export interface ExchangeRateResponse {
    rates: Record<string, number>;
    timestamp: number;
}
export interface ConversionResult {
    fromAmount: number;
    fromCurrency: string;
    toAmount: number;
    toCurrency: string;
    exchangeRate: number;
    timestamp: number;
}
export interface CurrencyConverterConfig {
    baseUrl: string;
    defaultCurrencies: {
        from: string;
        to: string;
    };
    allowedCurrencies?: string[];
}
export interface CurrencyDesc {
    code: string;
    description: string;
}
export interface ConversionHistoryEntry {
    fromAmount: number;
    fromCurrency: string;
    toAmount: number;
    toCurrency: string;
    exchangeRate: number;
    timestamp: number;
}

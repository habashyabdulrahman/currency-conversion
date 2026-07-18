const CURRENCY_FLAGS = {
    USD: "🇺🇸",
    EUR: "🇪🇺",
    GBP: "🇬🇧",
    EGP: "🇪🇬",
    CAD: "🇨🇦",
    AUD: "🇦🇺",
    CHF: "🇨🇭",
    PLN: "🇵🇱",
    BYN: "🇧🇾",
    JPY: "🇯🇵",
    CNY: "🇨🇳",
    INR: "🇮🇳",
    BRL: "🇧🇷",
    MXN: "🇲🇽",
    KRW: "🇰🇷",
    SGD: "🇸🇬",
    HKD: "🇭🇰",
    NOK: "🇳🇴",
    SEK: "🇸🇪",
    DKK: "🇩🇰",
    NZD: "🇳🇿",
    SAR: "🇸🇦",
    AED: "🇦🇪",
    TRY: "🇹🇷",
    ZAR: "🇿🇦",
};
export function getCurrencyFlag(code) {
    return CURRENCY_FLAGS[code.toUpperCase()] ?? "🏳️";
}
async function fetchJson(url, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
        }
        return await response.json();
    }
    catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw new Error("The request timed out");
        }
        throw error;
    }
    finally {
        window.clearTimeout(timeoutId);
    }
}
function parseOpenExchangeCurrencies(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Invalid currency list response");
    }
    return Object.fromEntries(Object.entries(data)
        .filter(([, description]) => typeof description === "string")
        .map(([code, description]) => [
        code.toUpperCase(),
        { code: code.toUpperCase(), description: String(description) },
    ]));
}
function parseFxRatesCurrencies(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Invalid currency symbols response");
    }
    const root = data;
    const source = root.symbols && typeof root.symbols === "object" && !Array.isArray(root.symbols)
        ? root.symbols
        : root;
    return Object.fromEntries(Object.entries(source).map(([rawCode, value]) => {
        const code = rawCode.toUpperCase();
        let description = code;
        if (typeof value === "string") {
            description = value;
        }
        else if (value && typeof value === "object" && "name" in value) {
            description = String(value.name ?? code);
        }
        return [code, { code, description }];
    }));
}
/**
 * Fetches the complete currency list dynamically, with a second provider as fallback.
 * The app can still filter that list through `allowedCurrencies` in its config.
 */
export async function fetchAllCurrencies(timeoutMs = 8_000) {
    const providers = [
        {
            url: "https://openexchangerates.org/api/currencies.json",
            parse: parseOpenExchangeCurrencies,
        },
        {
            url: "https://api.fxratesapi.com/symbols",
            parse: parseFxRatesCurrencies,
        },
    ];
    let lastError;
    for (const provider of providers) {
        try {
            const json = await fetchJson(provider.url, timeoutMs);
            const currencies = provider.parse(json);
            if (Object.keys(currencies).length > 0) {
                return currencies;
            }
        }
        catch (error) {
            lastError = error;
        }
    }
    throw lastError instanceof Error
        ? lastError
        : new Error("Unable to fetch the currency list");
}
export function parseGoldSpotResponse(data, fallbackTimestamp = Math.floor(Date.now() / 1_000)) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Invalid gold-price response");
    }
    const payload = data;
    const price = payload.price;
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
        throw new Error("Invalid gold-price response: missing price");
    }
    let timestamp = fallbackTimestamp;
    if (typeof payload.updatedAt === "string") {
        const parsedDate = new Date(payload.updatedAt);
        if (!Number.isNaN(parsedDate.getTime())) {
            timestamp = Math.floor(parsedDate.getTime() / 1_000);
        }
    }
    return {
        priceUsdPerOunce: price,
        timestamp,
    };
}
export const TROY_OUNCE_GRAMS = 31.1034768;
export function calculateGoldPrices(pricePerOunce) {
    if (!Number.isFinite(pricePerOunce) || pricePerOunce <= 0) {
        throw new Error("Gold price must be a positive finite number");
    }
    const gram24 = pricePerOunce / TROY_OUNCE_GRAMS;
    return {
        gram24,
        gram21: gram24 * (21 / 24),
    };
}
export function validateGoldWeight(value) {
    const trimmed = value.trim();
    if (trimmed === "")
        return { isValid: true, grams: 0 };
    const grams = Number(trimmed);
    if (!Number.isFinite(grams)) {
        return { isValid: false, error: "Please enter a valid gold weight" };
    }
    if (grams < 0) {
        return { isValid: false, error: "Gold weight cannot be negative" };
    }
    if (grams > 1e9) {
        return { isValid: false, error: "Gold weight is too large" };
    }
    return { isValid: true, grams };
}
export function calculateGoldValue(prices, karat, grams) {
    if (!Number.isFinite(grams) || grams < 0) {
        throw new Error("Gold weight must be a non-negative finite number");
    }
    const pricePerGram = karat === 24 ? prices.gram24 : prices.gram21;
    return pricePerGram * grams;
}
export function formatCurrency(amount, code) {
    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
        }).format(amount);
    }
    catch {
        return `${amount.toFixed(4)} ${code}`;
    }
}
export function formatExchangeRate(rate) {
    if (rate >= 100)
        return rate.toFixed(2);
    if (rate >= 1)
        return rate.toFixed(4);
    return rate.toFixed(6);
}
export const formatTimestamp = (timestamp) => new Date(timestamp * 1_000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});
export function debounce(callback, delay) {
    let timeoutId;
    return (...args) => {
        if (timeoutId !== undefined)
            clearTimeout(timeoutId);
        timeoutId = setTimeout(() => callback(...args), delay);
    };
}
export function validateAmount(value) {
    const trimmed = value.trim();
    if (trimmed === "") {
        return { isValid: false, error: "Please enter an amount" };
    }
    const amount = Number(trimmed);
    if (!Number.isFinite(amount)) {
        return { isValid: false, error: "Please enter a valid number" };
    }
    if (amount <= 0) {
        return { isValid: false, error: "Amount must be greater than 0" };
    }
    if (amount > 1e15) {
        return { isValid: false, error: "Amount is too large" };
    }
    return { isValid: true };
}
export async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.append(textArea);
    textArea.select();
    const copied = document.execCommand("copy");
    textArea.remove();
    if (!copied) {
        throw new Error("Clipboard access is unavailable");
    }
}

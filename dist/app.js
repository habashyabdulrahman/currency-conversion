import { calculateGoldValue, calculateGoldPrices, copyText, debounce, fetchAllCurrencies, formatCurrency, formatExchangeRate, formatTimestamp, getCurrencyFlag, parseGoldSpotResponse, validateAmount, validateGoldWeight, } from "./utils.js";
const rateCache = {};
let goldCache;
function requireElement(selector) {
    const element = document.querySelector(selector);
    if (!element)
        throw new Error(`Required element not found: ${selector}`);
    return element;
}
class CurrencyConverter {
    config;
    amount = requireElement("#amount");
    fromSelect = requireElement("#fromCurrency");
    toSelect = requireElement("#toCurrency");
    convertButton = requireElement("#convertBtn");
    swapButton = requireElement("#swapBtn");
    resultBox = requireElement("#result");
    errorBox = requireElement("#error");
    loadingBox = requireElement("#loading");
    themeToggle = requireElement("#themeToggle");
    presetChips = requireElement("#presetChips");
    copiedToast = requireElement("#copiedToast");
    resultAmount = requireElement("#result .result-amount");
    exchangeRate = requireElement("#result .exchange-rate");
    lastUpdated = requireElement("#result .last-updated");
    themeColorMeta = requireElement('meta[name="theme-color"]');
    currencyTab = requireElement("#currencyTab");
    goldTab = requireElement("#goldTab");
    currencyPanel = requireElement("#currencyPanel");
    goldPanel = requireElement("#goldPanel");
    goldCurrencySelect = requireElement("#goldCurrency");
    refreshGoldButton = requireElement("#refreshGoldBtn");
    goldResultBox = requireElement("#goldResult");
    goldLoadingBox = requireElement("#goldLoading");
    goldErrorBox = requireElement("#goldError");
    gold24Price = requireElement("#gold24Price");
    goldKaratSelect = requireElement("#goldKarat");
    goldWeight = requireElement("#goldWeight");
    goldCalculatedValue = requireElement("#goldCalculatedValue");
    goldCalculationLabel = requireElement("#goldCalculationLabel");
    goldSelectedUnitPrice = requireElement("#goldSelectedUnitPrice");
    goldCalculatorError = requireElement("#goldCalculatorError");
    goldUpdated = requireElement("#goldUpdated");
    conversionRequestId = 0;
    goldRequestId = 0;
    toastTimer;
    errorTimer;
    currenciesReady = false;
    activeView = "currency";
    currentGoldResult;
    constructor(config) {
        this.config = config;
        this.initTheme();
        this.initView();
        this.bindEvents();
        void this.populateCurrencies();
    }
    initTheme() {
        const savedTheme = localStorage.getItem("theme");
        const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)")
            .matches
            ? "dark"
            : "light";
        const initialTheme = savedTheme === "dark" || savedTheme === "light"
            ? savedTheme
            : preferredTheme;
        this.applyTheme(initialTheme);
    }
    applyTheme(theme) {
        document.documentElement.dataset.theme = theme;
        this.themeColorMeta.content = theme === "dark" ? "#0f172a" : "#f8fafc";
        const nextTheme = theme === "dark" ? "light" : "dark";
        this.themeToggle.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
        this.themeToggle.title = `Switch to ${nextTheme} theme`;
    }
    initView() {
        const savedView = localStorage.getItem("activeView");
        this.setView(savedView === "gold" ? "gold" : "currency", false);
    }
    setView(view, loadData = true) {
        this.activeView = view;
        const showingCurrency = view === "currency";
        this.currencyTab.classList.toggle("active", showingCurrency);
        this.currencyTab.setAttribute("aria-selected", String(showingCurrency));
        this.currencyTab.tabIndex = showingCurrency ? 0 : -1;
        this.goldTab.classList.toggle("active", !showingCurrency);
        this.goldTab.setAttribute("aria-selected", String(!showingCurrency));
        this.goldTab.tabIndex = showingCurrency ? -1 : 0;
        this.currencyPanel.classList.toggle("hidden", !showingCurrency);
        this.goldPanel.classList.toggle("hidden", showingCurrency);
        localStorage.setItem("activeView", view);
        if (loadData && view === "gold" && this.currenciesReady) {
            void this.loadGoldPrice();
        }
    }
    async populateCurrencies() {
        this.setCurrencyControlsLoading(true);
        try {
            const currencies = await fetchAllCurrencies(this.config.requestTimeoutMs);
            const allowed = this.config.allowedCurrencies
                ? new Set(this.config.allowedCurrencies.map((code) => code.toUpperCase()))
                : undefined;
            const sortedCodes = Object.keys(currencies)
                .filter((code) => !allowed || allowed.has(code))
                .sort();
            const firstCurrency = sortedCodes[0];
            if (!firstCurrency) {
                throw new Error("No currencies are available for the configured filter");
            }
            const secondCurrency = sortedCodes[1] ?? firstCurrency;
            this.populateSelectOptions(sortedCodes, currencies);
            const defaultFrom = this.config.defaultCurrencies.from.toUpperCase();
            const defaultTo = this.config.defaultCurrencies.to.toUpperCase();
            const defaultGold = this.config.defaultGoldCurrency.toUpperCase();
            this.fromSelect.value = sortedCodes.includes(defaultFrom)
                ? defaultFrom
                : firstCurrency;
            this.toSelect.value = sortedCodes.includes(defaultTo)
                ? defaultTo
                : secondCurrency;
            this.goldCurrencySelect.value = sortedCodes.includes(defaultGold)
                ? defaultGold
                : this.toSelect.value;
            this.currenciesReady = true;
            this.setCurrencyControlsLoading(false);
            this.updateChipStates();
            await this.convert();
            if (this.activeView === "gold") {
                await this.loadGoldPrice();
            }
        }
        catch (error) {
            this.currenciesReady = false;
            this.setCurrencyControlsLoading(false);
            const message = error instanceof Error ? error.message : "Unknown error";
            this.showError(`Failed to load currencies: ${message}. Please refresh.`);
            this.showGoldError(`Failed to load currencies: ${message}. Please refresh.`);
        }
    }
    populateSelectOptions(codes, currencies) {
        this.fromSelect.replaceChildren();
        this.toSelect.replaceChildren();
        this.goldCurrencySelect.replaceChildren();
        for (const code of codes) {
            const description = currencies[code]?.description ?? code;
            const label = `${getCurrencyFlag(code)} ${code} – ${description}`;
            this.fromSelect.add(new Option(label, code));
            this.toSelect.add(new Option(label, code));
            this.goldCurrencySelect.add(new Option(label, code));
        }
    }
    setCurrencyControlsLoading(loading) {
        const disabled = loading || !this.currenciesReady;
        this.amount.disabled = disabled;
        this.fromSelect.disabled = disabled;
        this.toSelect.disabled = disabled;
        this.goldCurrencySelect.disabled = disabled;
        this.swapButton.disabled = disabled;
        this.convertButton.disabled = disabled;
        this.refreshGoldButton.disabled = disabled;
        for (const chip of this.presetChips.querySelectorAll(".chip")) {
            chip.disabled = disabled;
        }
        if (loading) {
            this.fromSelect.replaceChildren(new Option("Loading…", ""));
            this.toSelect.replaceChildren(new Option("Loading…", ""));
            this.goldCurrencySelect.replaceChildren(new Option("Loading…", ""));
        }
    }
    bindEvents() {
        const runConversion = () => {
            void this.convert();
        };
        const debouncedConversion = debounce(runConversion, 300);
        this.themeToggle.addEventListener("click", () => {
            const currentTheme = document.documentElement.dataset.theme;
            const nextTheme = currentTheme === "dark" ? "light" : "dark";
            this.applyTheme(nextTheme);
            localStorage.setItem("theme", nextTheme);
        });
        this.currencyTab.addEventListener("click", () => this.setView("currency"));
        this.goldTab.addEventListener("click", () => this.setView("gold"));
        for (const tab of [this.currencyTab, this.goldTab]) {
            tab.addEventListener("keydown", (event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
                    return;
                event.preventDefault();
                const nextView = this.activeView === "currency" ? "gold" : "currency";
                this.setView(nextView);
                (nextView === "gold" ? this.goldTab : this.currencyTab).focus();
            });
        }
        this.convertButton.addEventListener("click", runConversion);
        this.swapButton.addEventListener("click", () => {
            [this.fromSelect.value, this.toSelect.value] = [
                this.toSelect.value,
                this.fromSelect.value,
            ];
            runConversion();
        });
        this.amount.addEventListener("input", () => {
            this.updateChipStates();
            debouncedConversion();
        });
        this.amount.addEventListener("keydown", (event) => {
            if (event.key === "Enter")
                runConversion();
        });
        this.fromSelect.addEventListener("change", runConversion);
        this.toSelect.addEventListener("change", runConversion);
        this.goldCurrencySelect.addEventListener("change", () => {
            void this.loadGoldPrice();
        });
        this.refreshGoldButton.addEventListener("click", () => {
            void this.loadGoldPrice(true);
        });
        this.goldKaratSelect.addEventListener("change", () => {
            this.updateGoldCalculator();
        });
        this.goldWeight.addEventListener("input", () => {
            this.updateGoldCalculator();
        });
        this.presetChips.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof Element))
                return;
            const chip = target.closest(".chip");
            const value = chip?.dataset.value;
            if (!value || chip.disabled)
                return;
            this.amount.value = value;
            this.updateChipStates();
            runConversion();
        });
        this.resultBox.addEventListener("click", () => {
            void this.copyResult();
        });
        this.resultBox.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void this.copyResult();
            }
        });
        document.addEventListener("keydown", (event) => {
            if (event.altKey && event.key.toLowerCase() === "s") {
                event.preventDefault();
                if (!this.swapButton.disabled)
                    this.swapButton.click();
            }
        });
    }
    async copyResult() {
        const text = this.resultAmount.textContent?.trim();
        if (!text || text === "—")
            return;
        try {
            await copyText(text);
            this.showCopiedToast();
        }
        catch {
            this.showNonBlockingError("Unable to copy automatically. Select the amount and copy it manually.");
        }
    }
    showNonBlockingError(message) {
        if (this.errorTimer !== undefined)
            clearTimeout(this.errorTimer);
        this.errorBox.textContent = message;
        this.errorBox.classList.remove("hidden");
        this.errorTimer = setTimeout(() => {
            this.errorBox.classList.add("hidden");
        }, 3_000);
    }
    showCopiedToast() {
        if (this.toastTimer !== undefined)
            clearTimeout(this.toastTimer);
        this.copiedToast.classList.add("show");
        this.toastTimer = setTimeout(() => {
            this.copiedToast.classList.remove("show");
        }, 1_200);
    }
    updateChipStates() {
        const amount = Number(this.amount.value);
        for (const chip of this.presetChips.querySelectorAll(".chip")) {
            const chipValue = Number(chip.dataset.value);
            chip.classList.toggle("active", Number.isFinite(amount) && chipValue === amount);
        }
    }
    setConversionLoading(loading) {
        this.convertButton.disabled = loading || !this.currenciesReady;
        this.convertButton.textContent = loading ? "Converting…" : "Convert";
        this.resultBox.setAttribute("aria-busy", String(loading));
    }
    showError(message) {
        if (this.errorTimer !== undefined)
            clearTimeout(this.errorTimer);
        this.setConversionLoading(false);
        this.errorBox.textContent = message;
        this.errorBox.classList.remove("hidden");
        this.resultBox.classList.add("hidden");
        this.loadingBox.classList.add("hidden");
    }
    showLoading() {
        if (this.errorTimer !== undefined)
            clearTimeout(this.errorTimer);
        this.setConversionLoading(true);
        this.loadingBox.classList.remove("hidden");
        this.errorBox.classList.add("hidden");
        this.resultBox.classList.add("hidden");
    }
    showResult(result) {
        if (this.errorTimer !== undefined)
            clearTimeout(this.errorTimer);
        this.setConversionLoading(false);
        this.resultAmount.textContent = formatCurrency(result.toAmount, result.toCurrency);
        this.exchangeRate.textContent =
            `1 ${result.fromCurrency} = ` +
                `${formatExchangeRate(result.exchangeRate)} ${result.toCurrency}`;
        this.lastUpdated.textContent = `Rates as of ${formatTimestamp(result.timestamp)}`;
        this.resultBox.classList.remove("hidden");
        this.errorBox.classList.add("hidden");
        this.loadingBox.classList.add("hidden");
    }
    setGoldLoading(loading) {
        const disabled = loading || !this.currenciesReady;
        this.goldCurrencySelect.disabled = disabled;
        this.refreshGoldButton.disabled = disabled;
        this.goldKaratSelect.disabled = disabled;
        this.goldWeight.disabled = disabled;
        this.refreshGoldButton.classList.toggle("loading-state", loading);
        this.goldResultBox.setAttribute("aria-busy", String(loading));
    }
    showGoldLoading() {
        this.setGoldLoading(true);
        this.goldLoadingBox.classList.remove("hidden");
        this.goldErrorBox.classList.add("hidden");
        this.goldResultBox.classList.add("hidden");
    }
    showGoldError(message) {
        this.setGoldLoading(false);
        this.currentGoldResult = undefined;
        this.goldErrorBox.textContent = message;
        this.goldErrorBox.classList.remove("hidden");
        this.goldLoadingBox.classList.add("hidden");
        this.goldResultBox.classList.add("hidden");
    }
    showGoldResult(result) {
        this.setGoldLoading(false);
        this.currentGoldResult = result;
        this.gold24Price.textContent = formatCurrency(result.gram24, result.currency);
        this.updateGoldCalculator();
        this.goldUpdated.textContent =
            result.currency === "USD"
                ? `Gold updated ${formatTimestamp(result.goldTimestamp)}`
                : `Gold updated ${formatTimestamp(result.goldTimestamp)} · ` +
                    `FX rates ${formatTimestamp(result.exchangeRateTimestamp)}`;
        this.goldResultBox.classList.remove("hidden");
        this.goldLoadingBox.classList.add("hidden");
        this.goldErrorBox.classList.add("hidden");
    }
    updateGoldCalculator() {
        const result = this.currentGoldResult;
        if (!result)
            return;
        const weight = validateGoldWeight(this.goldWeight.value);
        if (!weight.isValid) {
            this.goldCalculatorError.textContent = weight.error;
            this.goldCalculatorError.classList.remove("hidden");
            this.goldCalculatedValue.textContent = "—";
            this.goldSelectedUnitPrice.textContent = "— per gram";
            return;
        }
        this.goldCalculatorError.classList.add("hidden");
        this.goldCalculatorError.textContent = "";
        const karat = this.goldKaratSelect.value === "24" ? 24 : 21;
        const pricePerGram = karat === 24 ? result.gram24 : result.gram21;
        const value = calculateGoldValue(result, karat, weight.grams);
        const formattedWeight = new Intl.NumberFormat("en-US", {
            maximumFractionDigits: 4,
        }).format(weight.grams);
        this.goldCalculationLabel.textContent =
            `Value of ${formattedWeight} g · ${karat}K`;
        this.goldCalculatedValue.textContent = formatCurrency(value, result.currency);
        this.goldSelectedUnitPrice.textContent =
            `${formatCurrency(pricePerGram, result.currency)} per gram`;
    }
    async fetchRates(base) {
        const normalizedBase = base.toUpperCase();
        const now = Math.floor(Date.now() / 1_000);
        const cached = rateCache[normalizedBase];
        if (cached && now - cached.fetchedAt < this.config.cacheTtlSeconds) {
            return cached.data;
        }
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
        try {
            const url = `${this.config.baseUrl}?base=${encodeURIComponent(normalizedBase)}`;
            const response = await fetch(url, {
                signal: controller.signal,
                headers: { Accept: "application/json" },
            });
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`.trim());
            }
            const json = await response.json();
            if (!json || typeof json !== "object" || Array.isArray(json)) {
                throw new Error("Invalid API response");
            }
            const payload = json;
            if (!payload.rates || typeof payload.rates !== "object") {
                throw new Error("Invalid API response: missing rates");
            }
            const rates = Object.fromEntries(Object.entries(payload.rates)
                .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
                .map(([code, value]) => [code.toUpperCase(), value]));
            let timestamp = now;
            if (typeof payload.timestamp === "number" &&
                Number.isFinite(payload.timestamp)) {
                timestamp = payload.timestamp;
            }
            else if (typeof payload.date === "string") {
                const parsedDate = new Date(payload.date);
                if (!Number.isNaN(parsedDate.getTime())) {
                    timestamp = Math.floor(parsedDate.getTime() / 1_000);
                }
            }
            const data = { rates, timestamp };
            rateCache[normalizedBase] = { data, fetchedAt: now };
            return data;
        }
        catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                throw new Error("The exchange-rate request timed out");
            }
            throw error;
        }
        finally {
            window.clearTimeout(timeoutId);
        }
    }
    async fetchGoldSpot(forceRefresh = false) {
        const now = Math.floor(Date.now() / 1_000);
        if (!forceRefresh &&
            goldCache &&
            now - goldCache.fetchedAt < this.config.goldCacheTtlSeconds) {
            return goldCache.data;
        }
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
        try {
            const response = await fetch(this.config.goldApiUrl, {
                signal: controller.signal,
                cache: forceRefresh ? "no-cache" : "default",
                headers: { Accept: "application/json" },
            });
            if (!response.ok) {
                throw new Error(`Gold API error: ${response.status} ${response.statusText}`.trim());
            }
            const json = await response.json();
            const data = parseGoldSpotResponse(json, now);
            goldCache = { data, fetchedAt: now };
            return data;
        }
        catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                throw new Error("The gold-price request timed out");
            }
            throw error;
        }
        finally {
            window.clearTimeout(timeoutId);
        }
    }
    async convert() {
        const requestId = ++this.conversionRequestId;
        const amountText = this.amount.value.trim();
        const fromCurrency = this.fromSelect.value;
        const toCurrency = this.toSelect.value;
        if (!this.currenciesReady || !fromCurrency || !toCurrency)
            return;
        const validation = validateAmount(amountText);
        if (!validation.isValid) {
            this.showError(validation.error);
            return;
        }
        const amount = Number(amountText);
        if (fromCurrency === toCurrency) {
            this.showResult({
                fromAmount: amount,
                fromCurrency,
                toAmount: amount,
                toCurrency,
                exchangeRate: 1,
                timestamp: Math.floor(Date.now() / 1_000),
            });
            return;
        }
        try {
            this.showLoading();
            const data = await this.fetchRates(fromCurrency);
            if (requestId !== this.conversionRequestId)
                return;
            const rate = data.rates[toCurrency];
            if (rate === undefined) {
                throw new Error(`No exchange rate was found for ${toCurrency}`);
            }
            this.showResult({
                fromAmount: amount,
                fromCurrency,
                toAmount: amount * rate,
                toCurrency,
                exchangeRate: rate,
                timestamp: data.timestamp,
            });
        }
        catch (error) {
            if (requestId !== this.conversionRequestId)
                return;
            this.showError(error instanceof Error
                ? error.message
                : "Conversion failed. Please try again.");
        }
    }
    async loadGoldPrice(forceRefresh = false) {
        const requestId = ++this.goldRequestId;
        const currency = this.goldCurrencySelect.value.toUpperCase();
        if (!this.currenciesReady || !currency)
            return;
        try {
            this.showGoldLoading();
            const [goldSpot, rateData] = await Promise.all([
                this.fetchGoldSpot(forceRefresh),
                currency === "USD"
                    ? Promise.resolve({
                        rates: { USD: 1 },
                        timestamp: Math.floor(Date.now() / 1_000),
                    })
                    : this.fetchRates("USD"),
            ]);
            if (requestId !== this.goldRequestId)
                return;
            const exchangeRate = currency === "USD" ? 1 : rateData.rates[currency];
            if (exchangeRate === undefined) {
                throw new Error(`No USD exchange rate was found for ${currency}`);
            }
            const prices = calculateGoldPrices(goldSpot.priceUsdPerOunce * exchangeRate);
            this.showGoldResult({
                ...prices,
                currency,
                goldTimestamp: goldSpot.timestamp,
                exchangeRateTimestamp: rateData.timestamp,
            });
        }
        catch (error) {
            if (requestId !== this.goldRequestId)
                return;
            this.showGoldError(error instanceof Error
                ? error.message
                : "Gold price failed to load. Please try again.");
        }
    }
}
const config = {
    baseUrl: "https://api.fxratesapi.com/latest",
    goldApiUrl: "https://api.gold-api.com/price/XAU",
    defaultCurrencies: { from: "USD", to: "EGP" },
    defaultGoldCurrency: "EGP",
    allowedCurrencies: [
        "USD",
        "EUR",
        "GBP",
        "EGP",
        "CAD",
        "AUD",
        "CHF",
        "PLN",
        "BYN",
    ],
    cacheTtlSeconds: 300,
    goldCacheTtlSeconds: 30,
    requestTimeoutMs: 8_000,
};
new CurrencyConverter(config);

import {
  fetchAllCurrencies,
  formatCurrency,
  formatExchangeRate,
  formatTimestamp,
  debounce,
  validateAmount,
  getCurrencyFlag,
} from "./utils";
import type {
  CurrencyConverterConfig,
  ConversionResult,
  ExchangeRateResponse,
} from "./types";

/** In-memory exchange rate cache (5 min TTL) */
const cache: Record<string, ExchangeRateResponse> = {};

class CurrencyConverter {
  // ===== DOM Elements =====
  private amount = document.querySelector<HTMLInputElement>("#amount")!;
  private fromSel = document.querySelector<HTMLSelectElement>("#fromCurrency")!;
  private toSel = document.querySelector<HTMLSelectElement>("#toCurrency")!;
  private convertBtn =
    document.querySelector<HTMLButtonElement>("#convertBtn")!;
  private swapBtn = document.querySelector<HTMLButtonElement>("#swapBtn")!;
  private resBox = document.querySelector<HTMLElement>("#result")!;
  private errBox = document.querySelector<HTMLElement>("#error")!;
  private loadBox = document.querySelector<HTMLElement>("#loading")!;
  private themeToggle =
    document.querySelector<HTMLButtonElement>("#themeToggle")!;
  private presetChips = document.querySelector<HTMLElement>("#presetChips")!;
  private copiedToast = document.querySelector<HTMLElement>("#copiedToast")!;

  constructor(private cfg: CurrencyConverterConfig) {
    this.initTheme();
    this.populate();
    this.bind();
  }

  /* -------------------- Theme -------------------- */

  private initTheme() {
    const saved = localStorage.getItem("theme") ?? "light";
    document.documentElement.setAttribute("data-theme", saved);

    this.themeToggle.onclick = () => {
      const next =
        document.documentElement.getAttribute("data-theme") === "dark"
          ? "light"
          : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    };
  }

  /* -------------------- Populate -------------------- */

  private async populate() {
    this.setSelectsLoading(true);
    try {
      const list = await fetchAllCurrencies();

      const sorted = this.cfg.allowedCurrencies
        ? Object.keys(list)
            .filter((code) => this.cfg.allowedCurrencies!.includes(code))
            .sort()
        : Object.keys(list).sort();

      if (sorted.length === 0) {
        throw new Error("No currencies available for the configured filter.");
      }

      this.fromSel.length = 0;
      this.toSel.length = 0;

      for (const code of sorted) {
        const desc = list[code]?.description ?? code;
        const flag = getCurrencyFlag(code);
        const text = `${flag} ${code} – ${desc}`;
        this.fromSel.add(new Option(text, code));
        this.toSel.add(new Option(text, code));
      }

      const defaultFrom = this.cfg.defaultCurrencies.from;
      const defaultTo = this.cfg.defaultCurrencies.to;
      this.fromSel.value = sorted.includes(defaultFrom)
        ? defaultFrom
        : sorted[0];
      this.toSel.value = sorted.includes(defaultTo)
        ? defaultTo
        : (sorted[1] ?? sorted[0]);

      this.setSelectsLoading(false);
      this.updateChipStates();
      await this.convert();
    } catch (err) {
      this.setSelectsLoading(false);
      const message = err instanceof Error ? err.message : "Unknown error";
      this.showError(`Failed to load currencies: ${message}. Please refresh.`);
    }
  }

  private setSelectsLoading(loading: boolean) {
    this.fromSel.disabled = loading;
    this.toSel.disabled = loading;
    this.convertBtn.disabled = loading;
    if (loading) {
      this.fromSel.innerHTML = "<option>Loading…</option>";
      this.toSel.innerHTML = "<option>Loading…</option>";
    }
  }

  /* -------------------- Bind events -------------------- */

  private bind() {
    const run = () => this.convert();
    const debounced = debounce(run, 300);

    this.convertBtn.onclick = run;

    this.swapBtn.onclick = () => {
      [this.fromSel.value, this.toSel.value] = [
        this.toSel.value,
        this.fromSel.value,
      ];
      run();
    };

    this.amount.addEventListener("input", () => {
      this.updateChipStates();
      debounced();
    });

    this.amount.addEventListener("keydown", (e) => {
      if (e.key === "Enter") run();
    });

    this.fromSel.addEventListener("change", run);
    this.toSel.addEventListener("change", run);

    // Preset chips
    this.presetChips.addEventListener("click", (e) => {
      const chip = (e.target as HTMLElement).closest(".chip");
      if (!chip) return;
      const value = chip.getAttribute("data-value");
      if (value) {
        this.amount.value = value;
        this.updateChipStates();
        run();
      }
    });

    // Copy result
    this.resBox.addEventListener("click", () => {
      const text = this.resBox.querySelector(".result-amount")?.textContent;
      if (text && text !== "—" && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          this.copiedToast.classList.add("show");
          setTimeout(() => this.copiedToast.classList.remove("show"), 1200);
        });
      }
    });

    // Keyboard shortcut: Ctrl+S to swap
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        this.swapBtn.click();
      }
    });
  }

  private updateChipStates() {
    const val = parseFloat(this.amount.value);
    Array.from(this.presetChips.children).forEach((chip) => {
      const chipVal = parseFloat((chip as HTMLElement).dataset.value ?? "0");
      chip.classList.toggle("active", chipVal === val);
    });
  }

  /* -------------------- UI state -------------------- */

  private showError(msg: string) {
    this.errBox.textContent = msg;
    this.errBox.classList.remove("hidden");
    this.resBox.classList.add("hidden");
    this.loadBox.classList.add("hidden");
  }

  private showLoading() {
    this.loadBox.classList.remove("hidden");
    this.errBox.classList.add("hidden");
    this.resBox.classList.add("hidden");
  }

  private showResult(r: ConversionResult) {
    this.resBox.querySelector<HTMLElement>(".result-amount")!.textContent =
      formatCurrency(r.toAmount, r.toCurrency);
    this.resBox.querySelector<HTMLElement>(".exchange-rate")!.textContent =
      `1 ${r.fromCurrency} = ${formatExchangeRate(r.exchangeRate)} ${r.toCurrency}`;
    this.resBox.querySelector<HTMLElement>(".last-updated")!.textContent =
      `Rates as of ${formatTimestamp(r.timestamp)}`;

    this.resBox.classList.remove("hidden");
    this.errBox.classList.add("hidden");
    this.loadBox.classList.add("hidden");
  }

  /* -------------------- Core conversion -------------------- */

  private async fetchRates(base: string): Promise<ExchangeRateResponse> {
    const TTL = 300;
    const now = Math.floor(Date.now() / 1000);
    if (cache[base] && now - cache[base].timestamp < TTL) {
      return cache[base];
    }

    const url = `${this.cfg.baseUrl}?base=${encodeURIComponent(base)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    const json = await res.json();

    if (!json.rates || typeof json.rates !== "object") {
      throw new Error("Invalid API response: missing rates");
    }

    let timestamp: number;
    if (typeof json.timestamp === "number" && !isNaN(json.timestamp)) {
      timestamp = json.timestamp;
    } else if (typeof json.date === "string") {
      const d = new Date(json.date);
      timestamp = isNaN(d.getTime()) ? now : Math.floor(d.getTime() / 1000);
    } else {
      timestamp = now;
    }

    const data: ExchangeRateResponse = {
      rates: json.rates as Record<string, number>,
      timestamp,
    };
    cache[base] = data;
    return data;
  }

  private async convert() {
    const amtStr = this.amount.value.trim();
    const from = this.fromSel.value;
    const to = this.toSel.value;

    if (!from || !to) return;

    const v = validateAmount(amtStr);
    if (!v.isValid) {
      this.showError(v.error);
      return;
    }

    if (from === to) {
      this.showResult({
        fromAmount: +amtStr,
        fromCurrency: from,
        toAmount: +amtStr,
        toCurrency: to,
        exchangeRate: 1,
        timestamp: Math.floor(Date.now() / 1000),
      });
      return;
    }

    try {
      this.showLoading();
      const data = await this.fetchRates(from);
      const rate = data.rates[to];
      if (rate == null) throw new Error(`No rate found for ${to}`);

      this.showResult({
        fromAmount: +amtStr,
        fromCurrency: from,
        toAmount: +amtStr * rate,
        toCurrency: to,
        exchangeRate: rate,
        timestamp: data.timestamp,
      });
    } catch (e) {
      this.showError(
        e instanceof Error ? e.message : "Conversion failed. Please try again.",
      );
    }
  }
}

/* -------------------- Bootstrap -------------------- */
const cfg: CurrencyConverterConfig = {
  baseUrl: "https://api.fxratesapi.com/latest",
  defaultCurrencies: { from: "USD", to: "EGP" },
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
};

new CurrencyConverter(cfg);

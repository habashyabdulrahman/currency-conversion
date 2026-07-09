# CurConv – Currency Converter

A lightweight, production-ready currency converter web app built with vanilla TypeScript. Designed for speed, clarity, and a frictionless user experience.

---

## Features

- **Real-time conversion** with live exchange rates via [fxratesapi.com](https://api.fxratesapi.com)
- **Preset amount chips** – one-tap selection for common values (10, 50, 100, 500, 1,000, 5,000)
- **Click-to-copy result** – copy the converted amount to clipboard instantly
- **Keyboard shortcuts** – `Ctrl + S` to swap currencies, `Enter` to convert
- **Dark / light theme** – persisted in `localStorage`
- **In-memory caching** – exchange rates cached for 5 minutes to reduce API calls
- **Graceful error handling** – clear user-friendly messages for network or API failures
- **Responsive design** – works seamlessly on desktop and mobile

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript 5.x |
| Styling | Vanilla CSS (CSS custom properties for theming) |
| Build | `tsc` (or Vite / esbuild for bundling) |
| API | fxratesapi.com (free, no key required) |
| Fallback API | openexchangerates.org (for currency symbols) |

---

## File Structure

```
├── index.html          # Main markup
├── styles.css          # Theme-aware stylesheet
├── app.ts              # Core application logic & DOM controller
├── types.ts            # TypeScript interfaces
├── utils.ts            # Helpers, formatters, validators, API wrappers
├── assets/
│   └── icon.png        # Favicon
└── dist/
    └── app.js          # Compiled output (from app.ts)
```

---

## Quick Start

### 1. Clone & install

```bash
git clone <repo-url>
cd curconv
npm install -g typescript  # if not already installed
```

### 2. Compile TypeScript

```bash
tsc --outDir dist --module esnext --moduleResolution node --target es2020
```

Or use a `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### 3. Serve

Open `index.html` in any static server:

```bash
# Python 3
python -m http.server 8080

# Node.js (npx serve)
npx serve .

# VS Code Live Server extension
```

Then visit `http://localhost:8080`.

---

## Configuration

All behavior is controlled via the `cfg` object at the bottom of `app.ts`:

```typescript
const cfg: CurrencyConverterConfig = {
  baseUrl: "https://api.fxratesapi.com/latest",
  defaultCurrencies: { from: "USD", to: "EGP" },
  allowedCurrencies: ["USD", "EUR", "GBP", "EGP", "CAD", "AUD", "CHF", "PLN"],
};
```

| Option | Description |
|--------|-------------|
| `baseUrl` | Endpoint for fetching latest rates |
| `defaultCurrencies` | Pre-selected pair on first load |
| `allowedCurrencies` | Whitelist of currencies shown in dropdowns |

> **Note:** If a default currency is missing from `allowedCurrencies`, the app falls back to the first available currency automatically.

---

## API Reference

### Primary: fxratesapi.com

```
GET https://api.fxratesapi.com/latest?base=USD
```

**Response shape:**
```json
{
  "base": "USD",
  "date": "2024-06-15",
  "rates": {
    "EUR": 0.92,
    "EGP": 50.25
  }
}
```

### Fallback: openexchangerates.org (symbols)

```
GET https://openexchangerates.org/api/currencies.json
```

**Response shape:**
```json
{
  "USD": "United States Dollar",
  "EUR": "Euro"
}
```

---

## Architecture Notes

### Caching Strategy

Rates are cached in a simple in-memory object keyed by base currency:

```typescript
const cache: Record<string, ExchangeRateResponse> = {};
```

- **TTL:** 300 seconds (5 minutes)
- **Scope:** Per-page session (cleared on refresh)
- **Rationale:** Exchange rates don't change every second; this reduces API load and improves perceived performance.

### State Management

No external state library. The app uses:

- **DOM state:** Input values, select options, theme attribute
- **Runtime state:** `cache` object and the `CurrencyConverter` class instance
- **Persistence:** `localStorage` for theme preference only

This keeps the bundle size near zero and avoids dependency drift.

### Debouncing

The amount input is debounced at **300ms** to prevent firing a conversion on every keystroke:

```typescript
const debounced = debounce(run, 300);
```

---

## Security & Performance

| Concern | Mitigation |
|---------|------------|
| **XSS** | No `innerHTML` with user input. Result text uses `textContent`. Currency codes come from a hardcoded whitelist. |
| **Clipboard** | Uses `navigator.clipboard.writeText()` which requires a secure context (HTTPS or localhost). Gracefully fails if unavailable. |
| **API failures** | Dual fallback for currency symbols. Network errors show friendly messages instead of crashing. |
| **Input validation** | Rejects empty, non-numeric, negative, and excessively large (>1e15) amounts. |
| **Timestamp parsing** | Hardened against malformed API dates; falls back to `Date.now()` if parsing fails. |
| **CORS** | Relies on public APIs with open CORS policies. No proxy needed for local use. |

---

## Browser Support

| Feature | Minimum Version |
|---------|-----------------|
| Chrome | 80+ |
| Firefox | 75+ |
| Safari | 13.1+ |
| Edge | 80+ |

Required APIs: `fetch`, `Intl.NumberFormat`, `navigator.clipboard`, `localStorage`, CSS custom properties.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` (in amount field) | Convert |
| `Ctrl + S` | Swap From / To currencies |

---

## Customization Ideas

- **Add more preset chips:** Edit the `#presetChips` container in `index.html` and the chip click handler in `app.ts`.
- **Change the API:** Swap `baseUrl` to any Open Exchange Rates-compatible endpoint.
- **Add a backend proxy:** If you need to hide the API or add server-side caching, proxy requests through a small Node.js/Express or Next.js API route.
- **Add Service Worker:** For offline support, cache the last fetched rates in a Service Worker and serve stale data when offline.

---

## License

MIT – free for personal and commercial use.

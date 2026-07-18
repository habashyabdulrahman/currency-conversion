# CurConv – Currency & Gold

CurConv is a lightweight Progressive Web App built with vanilla TypeScript and CSS. It converts currencies using live exchange rates and includes a compact calculator for estimating the current value of 21K or 24K gold by weight.

## Features

- Live currency conversion with a configurable five-minute in-memory rate cache.
- Dynamic currency-name loading with a fallback provider.
- Optional `allowedCurrencies` filter, making currencies easy to add or remove.
- Live international gold spot price converted to any configured currency.
- A single compact gold calculator with a 21K/24K selector and weight input.
- A small 24K per-gram reference strip below the calculator.
- Thirty-second gold-price cache and a manual refresh button.
- Preset amount buttons and automatic debounced conversion.
- Swap shortcut with `Alt + S` and conversion with `Enter`.
- Click, Enter, or Space to copy the currency result.
- Light and dark themes saved in `localStorage`.
- Responsive and keyboard-accessible tabbed interface.
- Installable PWA with an offline app shell and cached API fallback.
- Request timeout handling and protection from stale overlapping responses.

## Gold-price meaning

The gold screen shows an international spot-price estimate. Choose 21K or 24K, enter the weight in grams, and the main card immediately shows the estimated total value. A separate compact strip keeps the current 24K per-gram price visible. Local jewellery-shop prices can differ because of dealer premiums, workmanship, taxes, and local market conditions.

Gold is fetched in USD per troy ounce, then converted using the existing exchange-rate provider. One troy ounce is treated as `31.1034768` grams:

```text
24K gram = ounce price / 31.1034768
21K gram = 24K gram × 21 / 24
estimated value = selected karat price per gram × weight
```

## Project structure

```text
.
├── assets/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon.png
├── dist/                    # Generated JavaScript and declarations
├── src/
│   ├── app.ts               # UI, currency conversion, and gold-price logic
│   ├── types.ts             # Shared TypeScript interfaces
│   └── utils.ts             # APIs, formatting, calculations, and helpers
├── tests/
│   └── utils.test.mjs
├── index.html
├── manifest.json
├── service-worker.js
├── styles.css
├── package.json
└── tsconfig.json
```

## Requirements

- Node.js 18 or newer.
- npm.
- A static web server. Opening `index.html` through `file://` is not recommended because modules and service workers require HTTP or HTTPS.

## Install and build

```bash
npm install
npm run build
```

The TypeScript source is compiled into `dist/`. Do not edit generated files in `dist/` manually.

## Development server

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Available commands

```bash
npm run build       # Clean and compile TypeScript
npm run typecheck   # Check types without writing output
npm test            # Build and run utility tests
```

## Currency configuration

The currency catalogue is fetched dynamically. The currencies shown in the currency converter and the gold-price selector are controlled by `allowedCurrencies` near the bottom of `src/app.ts`:

```ts
const config: CurrencyConverterConfig = {
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
```

Add or remove ISO currency codes from the array and run `npm run build`. To show every currency returned by the catalogue provider, remove `allowedCurrencies`.

## API behaviour

### Currency catalogue

The app tries these providers in order:

1. `https://openexchangerates.org/api/currencies.json`
2. `https://api.fxratesapi.com/symbols`

### Exchange rates

Rates are loaded from `https://api.fxratesapi.com/latest` with the selected base currency.

### Gold

International XAU spot price is loaded from:

```text
https://api.gold-api.com/price/XAU
```

The endpoint returns USD per troy ounce. CurConv uses the existing USD exchange-rate response to display gold in the selected configured currency.

## PWA and offline behaviour

- The application shell is pre-cached during installation.
- Static files use stale-while-revalidate.
- Navigation uses network-first with an offline `index.html` fallback.
- Currency and gold API responses use network-first and may fall back to a cached response up to 24 hours old.

The service worker uses relative paths, so it works at a domain root or inside a repository path such as GitHub Pages.

## Deploying

Run `npm run build`, then deploy:

```text
assets/
dist/
index.html
manifest.json
service-worker.js
styles.css
```

## Testing

```bash
npm test
```

Tests cover amount validation, exchange-rate formatting, flags, debounce behaviour, and gold karat calculations.

## License

MIT.

import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateGoldValue,
  calculateGoldPrices,
  debounce,
  formatExchangeRate,
  getCurrencyFlag,
  parseGoldSpotResponse,
  validateAmount,
  validateGoldWeight,
} from "../dist/utils.js";

test("validateAmount accepts positive finite numbers", () => {
  assert.deepEqual(validateAmount("100.50"), { isValid: true });
});

test("validateAmount rejects invalid values", () => {
  assert.equal(validateAmount("").isValid, false);
  assert.equal(validateAmount("0").isValid, false);
  assert.equal(validateAmount("-5").isValid, false);
  assert.equal(validateAmount("Infinity").isValid, false);
});

test("formatExchangeRate chooses useful precision", () => {
  assert.equal(formatExchangeRate(120.1234), "120.12");
  assert.equal(formatExchangeRate(2.123456), "2.1235");
  assert.equal(formatExchangeRate(0.1234567), "0.123457");
});

test("getCurrencyFlag supports configured and unknown currencies", () => {
  assert.equal(getCurrencyFlag("BYN"), "🇧🇾");
  assert.equal(getCurrencyFlag("xyz"), "🏳️");
});

test("debounce only runs the latest scheduled call", async () => {
  const values = [];
  const debounced = debounce((value) => values.push(value), 20);

  debounced(1);
  debounced(2);
  debounced(3);

  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepEqual(values, [3]);
});

test("calculateGoldPrices returns 21K and 24K gram prices", () => {
  const prices = calculateGoldPrices(3110.34768);

  assert.ok(Math.abs(prices.gram24 - 100) < 1e-10);
  assert.ok(Math.abs(prices.gram21 - 87.5) < 1e-10);
  assert.equal("ounce" in prices, false);
  assert.equal("gram18" in prices, false);
});

test("calculateGoldPrices rejects invalid spot prices", () => {
  assert.throws(() => calculateGoldPrices(0));
  assert.throws(() => calculateGoldPrices(Number.NaN));
});

test("validateGoldWeight accepts blank and positive values", () => {
  assert.deepEqual(validateGoldWeight(""), { isValid: true, grams: 0 });
  assert.deepEqual(validateGoldWeight("12.5"), {
    isValid: true,
    grams: 12.5,
  });
});

test("validateGoldWeight rejects negative and invalid values", () => {
  assert.equal(validateGoldWeight("-1").isValid, false);
  assert.equal(validateGoldWeight("abc").isValid, false);
  assert.equal(validateGoldWeight("Infinity").isValid, false);
});

test("calculateGoldValue calculates the selected karat", () => {
  const prices = { gram21: 5000, gram24: 6000 };

  assert.equal(calculateGoldValue(prices, 21, 10), 50000);
  assert.equal(calculateGoldValue(prices, 24, 2), 12000);
});

test("calculateGoldValue rejects negative weights", () => {
  assert.throws(() =>
    calculateGoldValue({ gram21: 5000, gram24: 6000 }, 21, -1),
  );
});

test("parseGoldSpotResponse reads price and timestamp", () => {
  const result = parseGoldSpotResponse(
    { price: 2500.5, updatedAt: "2026-07-18T10:00:00Z" },
    1,
  );

  assert.equal(result.priceUsdPerOunce, 2500.5);
  assert.equal(result.timestamp, 1784368800);
});

test("parseGoldSpotResponse rejects malformed responses", () => {
  assert.throws(() => parseGoldSpotResponse(null));
  assert.throws(() => parseGoldSpotResponse({ price: "2500" }));
});

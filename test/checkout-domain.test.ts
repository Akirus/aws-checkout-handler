import test from "node:test";
import assert from "node:assert/strict";

import { calculateTotals, validateCheckoutRequest } from "../src/checkout/domain.js";
import { HttpError } from "../src/shared/http.js";
import type { CheckoutRequest, ProductSnapshot } from "../src/checkout/types.js";

function validRequest(): CheckoutRequest {
  return {
    customerId: "cust_123",
    currency: "USD",
    items: [
      { productId: "prod_1", quantity: 2 },
      { productId: "prod_2", quantity: 1 }
    ],
    shippingAddress: {
      country: "US",
      city: "New York",
      postalCode: "10001",
      line1: "5th Avenue 1"
    },
    paymentMethod: {
      type: "stripe",
      paymentMethodId: "pm_abc123"
    }
  };
}

test("validateCheckoutRequest accepts a valid request", () => {
  assert.doesNotThrow(() => validateCheckoutRequest(validRequest()));
});

test("validateCheckoutRequest throws HttpError for missing customerId", () => {
  const request = validRequest();
  request.customerId = "";

  assert.throws(
    () => validateCheckoutRequest(request),
    (error: unknown) =>
      error instanceof HttpError && error.statusCode === 400 && error.message === "customerId is required"
  );
});

test("validateCheckoutRequest throws HttpError for invalid item quantity", () => {
  const request = validRequest();
  request.items[0]!.quantity = -1;

  assert.throws(
    () => validateCheckoutRequest(request),
    (error: unknown) =>
      error instanceof HttpError && error.statusCode === 400 && /Invalid quantity/.test(error.message)
  );
});

test("calculateTotals returns expected totals for US shipping", () => {
  const items: ProductSnapshot[] = [
    {
      productId: "prod_1",
      name: "Starter Pack",
      unitPrice: 4000,
      quantity: 2,
      lineTotal: 8000,
      currency: "USD"
    },
    {
      productId: "prod_2",
      name: "Premium Add-on",
      unitPrice: 2000,
      quantity: 1,
      lineTotal: 2000,
      currency: "USD"
    }
  ];

  assert.deepEqual(calculateTotals(items, "US", "USD"), {
    subtotal: 10000,
    tax: 2000,
    shipping: 500,
    total: 12500,
    currency: "USD"
  });
});

test("calculateTotals uses higher shipping outside the US", () => {
  const items: ProductSnapshot[] = [
    {
      productId: "prod_1",
      name: "Starter Pack",
      unitPrice: 4000,
      quantity: 1,
      lineTotal: 4000,
      currency: "USD"
    }
  ];

  assert.deepEqual(calculateTotals(items, "DE", "USD"), {
    subtotal: 4000,
    tax: 800,
    shipping: 1500,
    total: 6300,
    currency: "USD"
  });
});

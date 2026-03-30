import { HttpError } from "../shared/http.js";
import type { AmountBreakdown, CheckoutRequest, Currency, ProductSnapshot } from "./types.js";

// Named "domain" here because it holds checkout business rules independent of HTTP/Lambda concerns.
// In a larger production codebase, I would likely use more specific names such as validation.ts or totals.ts.
export function validateCheckoutRequest(request: CheckoutRequest): void {
  if (!request.customerId) {
    throw new HttpError(400, "customerId is required");
  }

  if (!request.currency) {
    throw new HttpError(400, "currency is required");
  }

  if (!Array.isArray(request.items) || request.items.length === 0) {
    throw new HttpError(400, "items must contain at least one item");
  }

  for (const item of request.items) {
    if (!item.productId) {
      throw new HttpError(400, "Each item must contain productId");
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new HttpError(400, `Invalid quantity for product ${item.productId}`);
    }
  }

  if (!request.shippingAddress?.country || !request.shippingAddress?.city || !request.shippingAddress?.postalCode) {
    throw new HttpError(400, "shippingAddress is incomplete");
  }

  if (!request.paymentMethod?.type || !request.paymentMethod?.paymentMethodId) {
    throw new HttpError(400, "paymentMethod is incomplete");
  }
}

export function calculateTotals(
  items: ProductSnapshot[],
  destinationCountry: string,
  currency: Currency
): AmountBreakdown {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const shipping = destinationCountry === "US" ? 500 : 1500;
  const tax = Math.round(subtotal * 0.2);
  const total = subtotal + shipping + tax;

  return {
    subtotal,
    tax,
    shipping,
    total,
    currency
  };
}

import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type {
  AmountBreakdown,
  CatalogProduct,
  CheckoutRequest,
  CheckoutResponse,
  Currency,
  PriceQuote,
  ProductSnapshot
} from "./checkout/types.js";
import { createCheckoutServices, type ServiceDependencies } from "./checkout/services.js";
import { enforceRoute, handleHttpError, HttpError, jsonResponse } from "./shared/http.js";

const services: ServiceDependencies = createCheckoutServices();

export function createHandler(deps: ServiceDependencies = services) {
  return async function checkoutHandler(
    event: APIGatewayProxyEventV2
  ): Promise<APIGatewayProxyStructuredResultV2> {
    try {
      enforceRoute(event, { method: "POST", path: "/v1/checkout" });

      const request = parseCheckoutRequest(event.body);
      validateCheckoutRequest(request);

      const response = await processCheckout(request, deps);
      return jsonResponse(201, response);
    } catch (error) {
      return handleHttpError(error);
    }
  };
}

export const handler = createHandler();

async function processCheckout(
  request: CheckoutRequest,
  deps: ServiceDependencies
): Promise<CheckoutResponse> {
  const productIds = uniqueProductIds(request.items);

  const [products, prices] = await Promise.all([
    deps.catalogService.getProducts(productIds),
    deps.pricingService.getPrices({ productIds, currency: request.currency })
  ]);

  const orderItems = buildOrderItems(request, products, prices);
  const amount = calculateTotals(orderItems, request.shippingAddress.country, request.currency);

  const order = await deps.orderService.createPendingOrder({
    status: "PENDING_PAYMENT",
    customerId: request.customerId,
    currency: request.currency,
    items: orderItems,
    shippingAddress: request.shippingAddress,
    amount
  });

  const invoice = await deps.invoiceService.createInvoice({
    orderId: order.orderId,
    customerId: request.customerId,
    amount,
    items: orderItems
  });

  const payment = await deps.paymentService.initiatePayment({
    orderId: order.orderId,
    customerId: request.customerId,
    amount,
    paymentMethod: request.paymentMethod,
    invoiceId: invoice.invoiceId
  });

  return {
    orderId: order.orderId,
    status: order.status,
    amount,
    payment
  };
}

function parseCheckoutRequest(body: string | undefined): CheckoutRequest {
  if (!body) {
    throw new HttpError(400, "Request body is required");
  }

  try {
    return JSON.parse(body) as CheckoutRequest;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

function validateCheckoutRequest(request: CheckoutRequest): void {
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

function uniqueProductIds(items: CheckoutRequest["items"]): string[] {
  return [...new Set(items.map((item) => item.productId))];
}

function buildOrderItems(
  request: CheckoutRequest,
  products: Map<string, CatalogProduct>,
  prices: Map<string, PriceQuote>
): ProductSnapshot[] {
  return request.items.map((item) => {
    const product = products.get(item.productId);
    if (!product || !product.active) {
      throw new HttpError(400, `Product ${item.productId} does not exist`);
    }

    const price = prices.get(item.productId);
    if (!price) {
      throw new HttpError(400, `Price missing for product ${item.productId}`);
    }

    return {
      productId: item.productId,
      name: product.name,
      unitPrice: price.unitPrice,
      quantity: item.quantity,
      lineTotal: price.unitPrice * item.quantity,
      currency: price.currency
    };
  });
}

function calculateTotals(
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

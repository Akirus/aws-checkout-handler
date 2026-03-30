import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type {
  AmountBreakdown,
  CatalogProduct,
  CheckoutRequest,
  CheckoutResponse,
  PriceQuote,
  ProductSnapshot
} from "./checkout/types.js";
import { createCheckoutServices, type ServiceDependencies } from "./checkout/services.js";
import { calculateTotals, validateCheckoutRequest } from "./checkout/domain.js";
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

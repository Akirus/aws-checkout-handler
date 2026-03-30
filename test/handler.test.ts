import test from "node:test";
import assert from "node:assert/strict";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

import { createHandler } from "../src/handler.js";
import { createCheckoutServices } from "../src/checkout/services.js";
import type { ServiceDependencies } from "../src/checkout/services.js";

function buildEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  const event: APIGatewayProxyEventV2 = {
    version: "2.0",
    routeKey: "POST /v1/checkout",
    rawPath: "/v1/checkout",
    rawQueryString: "",
    cookies: [],
    headers: {
      "content-type": "application/json"
    },
    queryStringParameters: undefined,
    requestContext: {
      accountId: "test",
      apiId: "test",
      domainName: "localhost",
      domainPrefix: "localhost",
      http: {
        method: "POST",
        path: "/v1/checkout",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "node-test"
      },
      requestId: "request-1",
      routeKey: "POST /v1/checkout",
      stage: "$default",
      time: "30/Mar/2026:12:00:00 +0000",
      timeEpoch: 1774872000000
    },
    body: JSON.stringify({
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
    }),
    pathParameters: undefined,
    isBase64Encoded: false,
    stageVariables: undefined
  };

  return {
    ...event,
    ...overrides,
    headers: {
      ...event.headers,
      ...overrides.headers
    },
    requestContext: {
      ...event.requestContext,
      ...overrides.requestContext,
      http: {
        ...event.requestContext.http,
        ...overrides.requestContext?.http
      }
    }
  };
}

function parseBody(responseBody: string | undefined) {
  assert.ok(responseBody);
  return JSON.parse(responseBody);
}

test("handler returns a checkout response for a valid request", async () => {
  const handler = createHandler();

  const response = await handler(buildEvent());

  assert.equal(response.statusCode, 201);
  assert.ok(response.body);

  const body = JSON.parse(response.body);
  assert.deepEqual(body, {
    orderId: "order_789",
    status: "PENDING_PAYMENT",
    amount: {
      subtotal: 10000,
      tax: 2000,
      shipping: 500,
      total: 12500,
      currency: "USD"
    },
    payment: {
      provider: "stripe",
      status: "REQUIRES_CONFIRMATION",
      paymentUrl: "https://payments.example.com/checkout/order_789?invoiceId=inv_order_789"
    }
  });
});

test("handler returns 400 when quantity is invalid", async () => {
  const handler = createHandler();
  const response = await handler(
    buildEvent({
      body: JSON.stringify({
        customerId: "cust_123",
        currency: "USD",
        items: [{ productId: "prod_1", quantity: 0 }],
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
      })
    })
  );

  assert.equal(response.statusCode, 400);
  assert.match(parseBody(response.body).error, /Invalid quantity/);
});

test("handler returns 400 when body is missing", async () => {
  const handler = createHandler();
  const response = await handler(buildEvent({ body: undefined }));

  assert.equal(response.statusCode, 400);
  assert.equal(parseBody(response.body).error, "Request body is required");
});

test("handler returns 400 when body is invalid JSON", async () => {
  const handler = createHandler();
  const response = await handler(buildEvent({ body: "{not-json" }));

  assert.equal(response.statusCode, 400);
  assert.equal(parseBody(response.body).error, "Request body must be valid JSON");
});

test("handler returns 400 when customerId is missing", async () => {
  const handler = createHandler();
  const response = await handler(
    buildEvent({
      body: JSON.stringify({
        currency: "USD",
        items: [{ productId: "prod_1", quantity: 1 }],
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
      })
    })
  );

  assert.equal(response.statusCode, 400);
  assert.equal(parseBody(response.body).error, "customerId is required");
});

test("handler returns 400 when items are empty", async () => {
  const handler = createHandler();
  const response = await handler(
    buildEvent({
      body: JSON.stringify({
        customerId: "cust_123",
        currency: "USD",
        items: [],
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
      })
    })
  );

  assert.equal(response.statusCode, 400);
  assert.equal(parseBody(response.body).error, "items must contain at least one item");
});

test("handler returns 400 when shipping address is incomplete", async () => {
  const handler = createHandler();
  const response = await handler(
    buildEvent({
      body: JSON.stringify({
        customerId: "cust_123",
        currency: "USD",
        items: [{ productId: "prod_1", quantity: 1 }],
        shippingAddress: {
          country: "US",
          city: "",
          postalCode: "10001",
          line1: "5th Avenue 1"
        },
        paymentMethod: {
          type: "stripe",
          paymentMethodId: "pm_abc123"
        }
      })
    })
  );

  assert.equal(response.statusCode, 400);
  assert.equal(parseBody(response.body).error, "shippingAddress is incomplete");
});

test("handler returns 400 when payment method is incomplete", async () => {
  const handler = createHandler();
  const response = await handler(
    buildEvent({
      body: JSON.stringify({
        customerId: "cust_123",
        currency: "USD",
        items: [{ productId: "prod_1", quantity: 1 }],
        shippingAddress: {
          country: "US",
          city: "New York",
          postalCode: "10001",
          line1: "5th Avenue 1"
        },
        paymentMethod: {
          type: "stripe"
        }
      })
    })
  );

  assert.equal(response.statusCode, 400);
  assert.equal(parseBody(response.body).error, "paymentMethod is incomplete");
});

test("handler returns 400 when product does not exist", async () => {
  const handler = createHandler();
  const response = await handler(
    buildEvent({
      body: JSON.stringify({
        customerId: "cust_123",
        currency: "USD",
        items: [{ productId: "prod_missing", quantity: 1 }],
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
      })
    })
  );

  assert.equal(response.statusCode, 400);
  assert.equal(parseBody(response.body).error, "Product prod_missing does not exist");
});

test("handler returns 404 for an unexpected route", async () => {
  const handler = createHandler();

  const response = await handler(
    buildEvent({
      rawPath: "/v1/orders",
      requestContext: {
        ...buildEvent().requestContext,
        http: {
          ...buildEvent().requestContext.http,
          path: "/v1/orders"
        },
        routeKey: "POST /v1/orders"
      },
      routeKey: "POST /v1/orders"
    })
  );

  assert.equal(response.statusCode, 404);
});

test("handler returns 500 when payment initiation throws", async () => {
  const baseServices = createCheckoutServices();
  const services: ServiceDependencies = {
    ...baseServices,
    paymentService: {
      async initiatePayment() {
        throw new Error("payment provider unavailable");
      }
    }
  };

  const handler = createHandler(services);
  const response = await handler(buildEvent());

  assert.equal(response.statusCode, 500);
  assert.equal(parseBody(response.body).error, "Internal server error");
});

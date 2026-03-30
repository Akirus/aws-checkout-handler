import type {
  AmountBreakdown,
  CatalogProduct,
  CheckoutRequest,
  Currency,
  InvoiceRecord,
  OrderRecord,
  PaymentResult,
  PriceQuote,
  ProductSnapshot
} from "./types.js";

export interface CatalogService {
  getProducts(productIds: string[]): Promise<Map<string, CatalogProduct>>;
}

export interface PricingService {
  getPrices(input: { productIds: string[]; currency: Currency }): Promise<Map<string, PriceQuote>>;
}

export interface OrderService {
  createPendingOrder(input: Omit<OrderRecord, "orderId" | "createdAt">): Promise<OrderRecord>;
}

export interface InvoiceService {
  createInvoice(input: {
    orderId: string;
    customerId: string;
    amount: AmountBreakdown;
    items: ProductSnapshot[];
  }): Promise<InvoiceRecord>;
}

export interface PaymentService {
  initiatePayment(input: {
    orderId: string;
    customerId: string;
    amount: AmountBreakdown;
    paymentMethod: CheckoutRequest["paymentMethod"];
    invoiceId: string;
  }): Promise<PaymentResult>;
}

export type ServiceDependencies = {
  catalogService: CatalogService;
  pricingService: PricingService;
  orderService: OrderService;
  invoiceService: InvoiceService;
  paymentService: PaymentService;
};

export function createCheckoutServices(): ServiceDependencies {
  return {
    catalogService: new InMemoryCatalogService(),
    pricingService: new StaticPricingService(),
    orderService: new StubOrderService(),
    invoiceService: new StubInvoiceService(),
    paymentService: new StubPaymentService()
  };
}

class InMemoryCatalogService implements CatalogService {
  private readonly products = new Map<string, CatalogProduct>([
    ["prod_1", { productId: "prod_1", name: "Starter Pack", active: true }],
    ["prod_2", { productId: "prod_2", name: "Premium Add-on", active: true }],
    ["prod_3", { productId: "prod_3", name: "Archived Product", active: false }]
  ]);

  async getProducts(productIds: string[]): Promise<Map<string, CatalogProduct>> {
    const entries = productIds
      .map((productId) => {
        const product = this.products.get(productId);
        if (!product) {
          return undefined;
        }

        return [productId, product] as const;
      })
      .filter(isDefinedEntry);

    return new Map(entries);
  }
}

class StaticPricingService implements PricingService {
  private readonly prices = new Map<string, number>([
    ["prod_1", 4000],
    ["prod_2", 2000],
    ["prod_3", 1000]
  ]);

  async getPrices(input: { productIds: string[]; currency: Currency }): Promise<Map<string, PriceQuote>> {
    return new Map(
      input.productIds
        .map((productId) => {
          const unitPrice = this.prices.get(productId);
          if (typeof unitPrice !== "number") {
            return undefined;
          }

          return [
            productId,
            {
              productId,
              currency: input.currency,
              unitPrice
            }
          ] as const;
        })
        .filter(isDefinedEntry)
    );
  }
}

class StubOrderService implements OrderService {
  async createPendingOrder(input: Omit<OrderRecord, "orderId" | "createdAt">): Promise<OrderRecord> {
    return {
      ...input,
      orderId: "order_789",
      createdAt: new Date().toISOString()
    };
  }
}

class StubInvoiceService implements InvoiceService {
  async createInvoice(input: {
    orderId: string;
    customerId: string;
    amount: AmountBreakdown;
    items: ProductSnapshot[];
  }): Promise<InvoiceRecord> {
    return {
      invoiceId: `inv_${input.orderId}`,
      orderId: input.orderId,
      total: input.amount.total,
      currency: input.amount.currency
    };
  }
}

class StubPaymentService implements PaymentService {
  async initiatePayment(input: {
    orderId: string;
    customerId: string;
    amount: AmountBreakdown;
    paymentMethod: CheckoutRequest["paymentMethod"];
    invoiceId: string;
  }): Promise<PaymentResult> {
    return {
      provider: input.paymentMethod.type,
      status: "REQUIRES_CONFIRMATION",
      paymentUrl: `https://payments.example.com/checkout/${input.orderId}?invoiceId=${input.invoiceId}`
    };
  }
}

function isDefinedEntry<K, V>(entry: readonly [K, V] | undefined): entry is readonly [K, V] {
  return entry !== undefined;
}

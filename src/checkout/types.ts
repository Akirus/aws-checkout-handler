export type Currency = "USD" | "EUR";
export type PaymentProvider = "stripe" | "paypal";

export type CheckoutRequest = {
  customerId: string;
  currency: Currency;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  shippingAddress: {
    country: string;
    city: string;
    postalCode: string;
    line1: string;
  };
  paymentMethod: {
    type: PaymentProvider;
    paymentMethodId: string;
  };
};

export type ProductSnapshot = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  currency: Currency;
};

export type AmountBreakdown = {
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: Currency;
};

export type OrderRecord = {
  orderId: string;
  status: "PENDING_PAYMENT";
  customerId: string;
  currency: Currency;
  items: ProductSnapshot[];
  shippingAddress: CheckoutRequest["shippingAddress"];
  amount: AmountBreakdown;
  createdAt: string;
};

export type PaymentResult = {
  provider: PaymentProvider;
  status: "REQUIRES_CONFIRMATION" | "PROCESSING";
  paymentUrl: string;
};

export type CheckoutResponse = {
  orderId: string;
  status: OrderRecord["status"];
  amount: AmountBreakdown;
  payment: PaymentResult;
};

export type CatalogProduct = {
  productId: string;
  name: string;
  active: boolean;
};

export type PriceQuote = {
  productId: string;
  currency: Currency;
  unitPrice: number;
};

export type InvoiceRecord = {
  invoiceId: string;
  orderId: string;
  total: number;
  currency: Currency;
};

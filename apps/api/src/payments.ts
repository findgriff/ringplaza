import { config } from "./config";
import { TenantRow } from "./types";

export type CheckoutSession = {
  provider: "stripe" | "paypal";
  url: string;
  expiresAt: Date;
};

export interface PaymentGateway {
  createCheckoutSession(input: {
    amountCents: number;
    currency: string;
    orderId: string;
    tenant: TenantRow;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession>;
}

export class StripeGateway implements PaymentGateway {
  async createCheckoutSession({
    amountCents,
    currency,
    orderId,
    successUrl,
    cancelUrl
  }: {
    amountCents: number;
    currency: string;
    orderId: string;
    tenant: TenantRow;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession> {
    // Stubbed checkout session; swap for Stripe SDK integration.
    const url = `${successUrl}?orderId=${orderId}&provider=stripe&amount=${amountCents}&currency=${currency}`;
    return {
      provider: "stripe",
      url,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    };
  }
}

export class PaypalGateway implements PaymentGateway {
  async createCheckoutSession({
    amountCents,
    currency,
    orderId,
    successUrl
  }: {
    amountCents: number;
    currency: string;
    orderId: string;
    tenant: TenantRow;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession> {
    const url = `${successUrl}?orderId=${orderId}&provider=paypal&amount=${amountCents}&currency=${currency}`;
    return {
      provider: "paypal",
      url,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    };
  }
}

export class CompositeGateway implements PaymentGateway {
  constructor(
    private readonly stripe = new StripeGateway(),
    private readonly paypal = new PaypalGateway()
  ) {}

  async createCheckoutSession(args: {
    amountCents: number;
    currency: string;
    orderId: string;
    tenant: TenantRow;
    successUrl: string;
    cancelUrl: string;
    provider?: "stripe" | "paypal";
  }): Promise<CheckoutSession> {
    if (args.provider === "paypal") {
      return this.paypal.createCheckoutSession(args);
    }
    return this.stripe.createCheckoutSession(args);
  }
}

export const payments = {
  gateway: new CompositeGateway(),
  secrets: {
    stripe: config.STRIPE_SECRET_KEY,
    paypal: {
      clientId: config.PAYPAL_CLIENT_ID,
      clientSecret: config.PAYPAL_CLIENT_SECRET
    }
  }
};

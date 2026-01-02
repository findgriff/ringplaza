import { config } from "../config";
import { TenantsTable } from "../types";
import { withTenantContext } from "../db";
import { finalizeOrder } from "../ops";

const PAYPAL_API = "https://api-m.sandbox.paypal.com";

async function paypalAuth() {
  const creds = Buffer.from(`${config.PAYPAL_CLIENT_ID}:${config.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  if (!res.ok) throw new Error("PayPal auth failed");
  const data = await res.json();
  return data.access_token as string;
}

export async function createPayPalOrder(input: {
  amountCents: number;
  currency: string;
  orderId: string;
  tenant: TenantsTable;
  successUrl: string;
  cancelUrl: string;
}) {
  const token = await paypalAuth();
  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.orderId,
          amount: {
            currency_code: input.currency.toUpperCase(),
            value: (input.amountCents / 100).toFixed(2)
          }
        }
      ],
      application_context: {
        return_url: input.successUrl,
        cancel_url: input.cancelUrl
      }
    })
  });

  if (!res.ok) {
    throw new Error(`PayPal create order failed: ${res.status}`);
  }
  return res.json() as Promise<{ id: string; links: Array<{ rel: string; href: string }> }>;
}

export async function capturePayPalOrder(orderId: string) {
  const token = await paypalAuth();
  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error(`PayPal capture failed: ${res.status}`);
  return res.json();
}

export async function finalizePayPalOrder(params: {
  tenantId: string;
  orderId: string;
  providerOrderId: string;
}) {
  await finalizeOrder({
    tenantId: params.tenantId,
    orderId: params.orderId,
    idempotencyKey: params.providerOrderId,
    provider: "paypal",
    providerRef: params.providerOrderId,
    procurementEnabled: false
  });
}

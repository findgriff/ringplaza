const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
const TENANT_HOST = process.env.NEXT_PUBLIC_TENANT_HOST || "demo.shops.ringplaza.com";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "x-tenant": TENANT_HOST,
      "content-type": "application/json",
      ...(init?.headers || {})
    },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getProducts() {
  return api<Array<{ id: string; title: string; handle: string; description?: string; status: string }>>(
    "/api/products"
  );
}

export async function getProduct(handle: string) {
  const products = await getProducts();
  return products.find((p) => p.handle === handle);
}

export async function createCheckout(amountCents: number, currency = "USD") {
  return api<{ checkoutUrl: string }>("/api/checkout", {
    method: "POST",
    body: JSON.stringify({ amountCents, currency })
  });
}

export async function createStripeCheckoutSession(amountCents: number, currency = "USD") {
  return api<{ url: string; id: string; orderId: string }>("/api/checkout/session", {
    method: "POST",
    body: JSON.stringify({ amountCents, currency })
  });
}

export async function createPayPalOrder(amountCents: number, currency = "USD") {
  return api<{ url?: string; id: string; orderId: string }>("/api/paypal/create-order", {
    method: "POST",
    body: JSON.stringify({ amountCents, currency })
  });
}

export async function capturePayPalOrder(providerOrderId: string, orderId: string) {
  return api<{ status: string }>("/api/paypal/capture", {
    method: "POST",
    body: JSON.stringify({ providerOrderId, orderId })
  });
}

export type MetricPoint = { day: string; orders: number; revenue_cents: number; aov_cents: number };

export async function getAdminMetrics(params?: { from?: string; to?: string }) {
  const query = new URLSearchParams();
  if (params?.from) query.append("from", params.from);
  if (params?.to) query.append("to", params.to);
  const path = `/api/admin/metrics${query.toString() ? `?${query.toString()}` : ""}`;
  return api<{ series: MetricPoint[] }>(path);
}

export async function getAdminUsage() {
  return api<{ planId?: string; orderLimit?: number | null; usage: number; allowed: boolean; graceRemaining: number }>(
    "/api/admin/usage"
  );
}

export async function createBillingSubscription(priceId: string) {
  return api<{ url: string }>("/api/billing/subscribe", {
    method: "POST",
    body: JSON.stringify({ priceId })
  });
}

export async function createBillingPortal() {
  return api<{ url: string }>("/api/billing/portal", { method: "POST" });
}

export async function startShopifyCsvImport(filename?: string) {
  return api<{ jobId: string; status: string }>("/imports/shopify/csv", {
    method: "POST",
    body: JSON.stringify({ filename })
  });
}

export async function startShopifyGraphqlImport(shopDomain: string, accessToken: string) {
  return api<{ jobId: string; status: string }>("/imports/shopify/graphql", {
    method: "POST",
    body: JSON.stringify({ shopDomain, accessToken })
  });
}

export async function getImportStatus(id: string) {
  return api<{ id: string; status: string; metadata?: any }>(`/api/imports/${id}`);
}

export async function startAliExpressImport(url: string) {
  return api<{ jobId: string; status: string }>("/imports/aliexpress/url", {
    method: "POST",
    body: JSON.stringify({ url })
  });
}

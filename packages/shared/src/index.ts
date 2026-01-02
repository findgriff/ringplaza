import { z } from "zod";

export const planIds = ["starter", "unlimited"] as const;
export type PlanId = (typeof planIds)[number];

export const themeMode = ["light", "dark"] as const;
export type ThemeMode = (typeof themeMode)[number];

export const tenantSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(3),
  domain: z.string().url().optional(),
  previewDomain: z.string().url(),
  planId: z.enum(planIds),
  billingMode: z.enum(["saas", "selfhost", "appsumo"]),
  timezone: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  themeSettings: z.record(z.any()).optional()
});
export type Tenant = z.infer<typeof tenantSchema>;

export const moneySchema = z.object({
  currency: z.string().length(3),
  amount: z.number()
});
export type Money = z.infer<typeof moneySchema>;

export const productSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  title: z.string(),
  handle: z.string(),
  description: z.string().optional(),
  status: z.enum(["draft", "active"]),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Product = z.infer<typeof productSchema>;

export const variantSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  sku: z.string(),
  priceCents: z.number(),
  compareAtPriceCents: z.number().optional(),
  optionValues: z.record(z.string()),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Variant = z.infer<typeof variantSchema>;

export const orderStatus = ["pending", "paid", "fulfilled", "refunded", "canceled"] as const;
export type OrderStatus = (typeof orderStatus)[number];

export const orderSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  status: z.enum(orderStatus),
  totalCents: z.number(),
  currency: z.string().length(3),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Order = z.infer<typeof orderSchema>;

export type ThemeSettings = {
  palette: "sleek" | "bold";
  primaryColor: string;
  accentColor: string;
  background: string;
  text: string;
  mode: ThemeMode;
};

export const defaultThemeSettings: ThemeSettings = {
  palette: "sleek",
  primaryColor: "#0f172a",
  accentColor: "#0dd6c6",
  background: "#f8fafc",
  text: "#0b1220",
  mode: "light"
};

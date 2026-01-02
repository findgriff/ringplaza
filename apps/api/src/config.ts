import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const configSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().url(),
  WEB_APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ENDPOINT: z.string().min(1),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_STARTER: z.string().min(1),
  STRIPE_PRICE_UNLIMITED: z.string().min(1),
  STRIPE_PRICE_PROCUREMENT: z.string().min(1),
  PAYPAL_CLIENT_ID: z.string().min(1),
  PAYPAL_CLIENT_SECRET: z.string().min(1),
  SMTP_URL: z.string().min(1),
  FROM_EMAIL: z.string().email()
});

export type AppConfig = z.infer<typeof configSchema>;
export const config: AppConfig = configSchema.parse(process.env);

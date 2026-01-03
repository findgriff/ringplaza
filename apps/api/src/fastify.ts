import "fastify";
import { TenantRow } from "./types";

declare module "fastify" {
  interface FastifyRequest {
    tenant?: TenantRow;
  }
}

export {};

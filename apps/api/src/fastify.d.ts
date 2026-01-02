import "fastify";
import { TenantsTable } from "./types";

declare module "fastify" {
  interface FastifyRequest {
    tenant?: TenantsTable;
  }
}

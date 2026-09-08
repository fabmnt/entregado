import type { DirectoryBusiness } from "@entregado/types"
import { api, getConvexClient } from "./convex"

export async function listBusinesses(): Promise<DirectoryBusiness[]> {
  return await getConvexClient().query(api.businesses.list, {})
}

export async function getBusinessBySlug(
  slug: string
): Promise<DirectoryBusiness | null> {
  return await getConvexClient().query(api.businesses.getBySlug, { slug })
}

export function getBusinessAppUrl(): string {
  const url = import.meta.env.PUBLIC_BUSINESS_URL
  if (typeof url === "string" && url.length > 0) {
    return url.replace(/\/$/, "")
  }
  if (import.meta.env.DEV) {
    return "http://localhost:4322"
  }
  throw new Error("PUBLIC_BUSINESS_URL is required outside local development")
}

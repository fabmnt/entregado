import type { DirectoryBusiness } from "@entregado/types"
import { api, getConvexClient } from "./convex"

const DIRECTORY_PAGE_SIZE = 12

// Convex rejects cursors that do not belong to this query, so a stale or
// hand-edited link falls back to the first page instead of failing.
function isInvalidCursorError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("InvalidCursor")
}

export async function listBusinesses(cursor: string | null) {
  try {
    return await getConvexClient().query(api.businesses.list, {
      paginationOpts: { numItems: DIRECTORY_PAGE_SIZE, cursor },
    })
  } catch (error) {
    if (cursor === null || !isInvalidCursorError(error)) {
      throw error
    }
    return await getConvexClient().query(api.businesses.list, {
      paginationOpts: { numItems: DIRECTORY_PAGE_SIZE, cursor: null },
    })
  }
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

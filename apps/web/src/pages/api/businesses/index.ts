import type { APIRoute } from "astro"
import { listBusinesses } from "../../../lib/businesses"
import { json } from "../../../lib/http"

export const GET: APIRoute = async ({ url }) => {
  const result = await listBusinesses(url.searchParams.get("cursor"))
  return json({
    businesses: result.page,
    continueCursor: result.continueCursor,
    isDone: result.isDone,
  })
}

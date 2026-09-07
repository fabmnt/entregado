import type { APIRoute } from "astro"
import { listBusinesses } from "../../../lib/businesses"
import { json } from "../../../lib/http"

export const GET: APIRoute = async () => {
  const businesses = await listBusinesses()
  return json({ businesses })
}

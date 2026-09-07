import type { APIRoute } from "astro"
import { getBusinessBySlug } from "../../../lib/businesses"
import { json } from "../../../lib/http"

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug

  if (!slug) {
    return json({ error: "Slug is required" }, 400)
  }

  const business = await getBusinessBySlug(slug)

  if (!business) {
    return json({ error: "Business not found" }, 404)
  }

  return json({ business })
}

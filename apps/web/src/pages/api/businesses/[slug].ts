import type { APIRoute } from "astro"
import { getBusinessBySlug } from "../../../lib/businesses"
import { json } from "../../../lib/http"

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug

  if (!slug) {
    return json({ error: "Falta el slug" }, 400)
  }

  const business = await getBusinessBySlug(slug)

  if (!business) {
    return json({ error: "No encontramos ese negocio" }, 404)
  }

  return json({ business })
}

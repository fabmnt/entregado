import type { Id } from "@entregado/backend"
import type { APIRoute } from "astro"
import { json } from "../../../lib/http"
import { getPublicSale } from "../../../lib/sales"
import { buildOrderTracking } from "../../../lib/tracking"

export const GET: APIRoute = async ({ params, url }) => {
  const saleId = params.saleId
  const slug = url.searchParams.get("slug")

  if (!saleId || !slug) {
    return json({ error: "Missing saleId or slug" }, 400)
  }

  const sale = await getPublicSale(slug, saleId as Id<"sales">)
  if (!sale) {
    return json({ error: "Sale not found" }, 404)
  }

  return json(buildOrderTracking(sale))
}

import type { Id } from "@entregado/backend"
import type { APIRoute } from "astro"
import { json } from "../../../lib/http"
import { getPublicOrder } from "../../../lib/orders"
import { buildOrderTracking } from "../../../lib/tracking"

export const GET: APIRoute = async ({ params, url }) => {
  const orderId = params.orderId
  const slug = url.searchParams.get("slug")

  if (!orderId || !slug) {
    return json({ error: "Missing orderId or slug" }, 400)
  }

  const order = await getPublicOrder(slug, orderId as Id<"orders">)
  if (!order) {
    return json({ error: "Order not found" }, 404)
  }

  return json(buildOrderTracking(order))
}

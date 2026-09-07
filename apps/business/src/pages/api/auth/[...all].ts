import type { APIRoute } from "astro"
import { forwardToConvexAuth } from "../../../lib/auth-server"

export const GET: APIRoute = async ({ request }) => {
  return await forwardToConvexAuth(request)
}

export const POST: APIRoute = async ({ request }) => {
  return await forwardToConvexAuth(request)
}

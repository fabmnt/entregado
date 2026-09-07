import type { APIRoute } from "astro"
import { getConvexAccessToken } from "../../../lib/auth-server"
import { createBusiness, listBusinesses } from "../../../lib/businesses"
import { json } from "../../../lib/http"

export const GET: APIRoute = async () => {
  const businesses = await listBusinesses()
  return json({ businesses })
}

export const POST: APIRoute = async ({ request }) => {
  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return json({ error: "Request body must be JSON" }, 400)
  }

  const token = await getConvexAccessToken(request)
  const result = await createBusiness(payload, token)

  if (!result.ok) {
    return json(
      { error: result.error, fieldErrors: result.fieldErrors },
      result.status
    )
  }

  return json({ business: result.business }, 201)
}

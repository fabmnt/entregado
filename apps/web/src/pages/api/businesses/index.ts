import type { APIRoute } from "astro"
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
    return json({ error: "El cuerpo debe ser JSON" }, 400)
  }

  const result = await createBusiness(payload)

  if (!result.ok) {
    return json(
      { error: result.error, fieldErrors: result.fieldErrors },
      result.status
    )
  }

  return json({ business: result.business }, 201)
}

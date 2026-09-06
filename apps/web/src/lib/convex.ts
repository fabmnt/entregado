import { ConvexHttpClient } from "convex/browser"
import { api } from "../../convex/_generated/api"

export function getConvexClient(): ConvexHttpClient {
  const url = import.meta.env.PUBLIC_CONVEX_URL ?? import.meta.env.CONVEX_URL

  if (typeof url !== "string" || url.length === 0) {
    throw new Error("Set PUBLIC_CONVEX_URL or CONVEX_URL")
  }

  return new ConvexHttpClient(url)
}

export { api }

import { api } from "@entregado/backend"
import { ConvexHttpClient } from "convex/browser"

function getConvexUrl(): string {
  const url = import.meta.env.PUBLIC_CONVEX_URL ?? import.meta.env.CONVEX_URL

  if (typeof url !== "string" || url.length === 0) {
    throw new Error("Set PUBLIC_CONVEX_URL or CONVEX_URL")
  }

  return url
}

export function getConvexSiteUrl(): string {
  const explicit =
    import.meta.env.PUBLIC_CONVEX_SITE_URL ?? import.meta.env.CONVEX_SITE_URL
  if (typeof explicit === "string" && explicit.length > 0) {
    return explicit.replace(/\/$/, "")
  }

  const cloudUrl = getConvexUrl()
  if (cloudUrl.includes(".convex.cloud")) {
    return cloudUrl.replace(".convex.cloud", ".convex.site")
  }

  throw new Error("Set PUBLIC_CONVEX_SITE_URL")
}

export function getConvexClient(token?: string | null): ConvexHttpClient {
  const client = new ConvexHttpClient(getConvexUrl(), {
    ...(token ? { auth: token } : {}),
  })
  return client
}

export { api }

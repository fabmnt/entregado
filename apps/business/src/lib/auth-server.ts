import { getToken } from "@convex-dev/better-auth/utils"
import { getConvexSiteUrl } from "./convex"

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1"
}

export function getConvexSiteUrlForAuth(): string {
  const url = getConvexSiteUrl()
  const parsed = new URL(url)

  if (parsed.hostname.endsWith(".convex.cloud")) {
    throw new Error(
      "PUBLIC_CONVEX_SITE_URL must end in .convex.site, not .convex.cloud"
    )
  }

  const isHttps = parsed.protocol === "https:"
  const isLocalHttp =
    parsed.protocol === "http:" && isLoopbackHostname(parsed.hostname)
  if (!isHttps && !isLocalHttp) {
    throw new Error("PUBLIC_CONVEX_SITE_URL must use https")
  }

  return url
}

export async function forwardToConvexAuth(request: Request): Promise<Response> {
  const siteUrl = getConvexSiteUrlForAuth()
  const requestUrl = new URL(request.url)
  const nextUrl = `${siteUrl}${requestUrl.pathname}${requestUrl.search}`

  const headers = new Headers(request.headers)
  headers.delete("transfer-encoding")
  headers.delete("content-length")
  headers.delete("connection")
  headers.delete("x-forwarded-host")
  headers.set("accept-encoding", "application/json")
  headers.set("host", new URL(siteUrl).host)
  headers.set("x-forwarded-proto", requestUrl.protocol.replace(/:$/, ""))
  headers.set("x-better-auth-forwarded-host", requestUrl.host)
  headers.set(
    "x-better-auth-forwarded-proto",
    requestUrl.protocol.replace(/:$/, "")
  )

  const init: RequestInit = {
    headers,
    method: request.method,
    redirect: "manual",
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.arrayBuffer()
    if (body.byteLength > 0) {
      init.body = body
    }
  }

  return fetch(nextUrl, init)
}

export async function getConvexAccessToken(
  request: Request
): Promise<string | null> {
  const siteUrl = getConvexSiteUrlForAuth()
  const headers = new Headers(request.headers)
  const forwardedHost = headers.get("x-forwarded-host")
  headers.delete("x-forwarded-host")
  headers.delete("content-length")
  headers.delete("transfer-encoding")
  headers.set("accept-encoding", "identity")
  if (forwardedHost) {
    headers.set("x-better-auth-forwarded-host", forwardedHost)
  }

  const result = await getToken(siteUrl, headers)
  return result.token ?? null
}

export function redirectWithCookies(
  location: string,
  source: Response
): Response {
  const headers = new Headers()
  headers.set("Location", location)
  for (const cookie of source.headers.getSetCookie()) {
    headers.append("Set-Cookie", cookie)
  }
  return new Response(null, { status: 303, headers })
}

export async function postConvexAuth(
  request: Request,
  path: string,
  body: Record<string, string>
): Promise<Response> {
  const headers = new Headers(request.headers)
  headers.set("content-type", "application/json")
  headers.delete("content-length")
  headers.delete("transfer-encoding")

  const authRequest = new Request(new URL(path, request.url), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  return await forwardToConvexAuth(authRequest)
}

import { defineMiddleware } from "astro:middleware"
import { getConvexAccessToken } from "./lib/auth-server"
import { api, getConvexClient } from "./lib/convex"

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/")
}

function isAuthPage(pathname: string): boolean {
  return pathname === "/login" || pathname === "/register"
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url

  if (!isAdminPath(pathname) && !isAuthPage(pathname)) {
    context.locals.user = null
    context.locals.convexToken = null
    return next()
  }

  const token = await getConvexAccessToken(context.request)
  let user = null

  if (token) {
    try {
      user = await getConvexClient(token).query(api.identity.getCurrentUser, {})
    } catch {
      user = null
    }
  }

  context.locals.user = user
  context.locals.convexToken = token

  if (isAdminPath(pathname) && !user) {
    return context.redirect("/login")
  }

  if (isAuthPage(pathname) && user) {
    return context.redirect("/admin")
  }

  return next()
})

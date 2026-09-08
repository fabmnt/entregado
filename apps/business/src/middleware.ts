import { defineMiddleware } from "astro:middleware"
import { getConvexAccessToken } from "./lib/auth-server"
import { api, getConvexClient } from "./lib/convex"

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/")
}

function isRiderPath(pathname: string): boolean {
  return pathname === "/rider" || pathname.startsWith("/rider/")
}

function isAuthPage(pathname: string): boolean {
  return pathname === "/login" || pathname === "/register"
}

function needsSession(pathname: string): boolean {
  return (
    isAdminPath(pathname) ||
    isRiderPath(pathname) ||
    isAuthPage(pathname) ||
    pathname === "/"
  )
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url

  if (!needsSession(pathname)) {
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

  if ((isAdminPath(pathname) || pathname === "/") && !user) {
    return context.redirect("/login")
  }

  if (isRiderPath(pathname) && !user) {
    return context.redirect("/login")
  }

  if (user?.kind === "rider" && (isAdminPath(pathname) || pathname === "/")) {
    return context.redirect("/rider")
  }

  if (user && user.kind !== "rider" && isRiderPath(pathname)) {
    return context.redirect("/admin")
  }

  if (isAuthPage(pathname) && user) {
    return context.redirect(user.kind === "rider" ? "/rider" : "/admin")
  }

  return next()
})

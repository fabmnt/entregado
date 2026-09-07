import { ConvexError, v } from "convex/values"
import { authComponent } from "./auth"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { query } from "./_generated/server"

export const userKind = v.union(v.literal("admin"), v.literal("business_owner"))

export const signedInUser = v.object({
  tokenIdentifier: v.string(),
  email: v.string(),
  name: v.string(),
  kind: userKind,
})

type SignedInUser = {
  tokenIdentifier: string
  email: string
  name: string
  kind: "admin" | "business_owner"
}

function generalAdminEmails(): Set<string> {
  const raw = process.env.GENERAL_ADMIN_EMAILS ?? ""
  return new Set(
    raw
      .split(",")
      .map((value: string) => value.trim().toLowerCase())
      .filter((value: string) => value.length > 0)
  )
}

export function kindForEmail(email: string): SignedInUser["kind"] {
  if (generalAdminEmails().has(email.toLowerCase())) {
    return "admin"
  }
  return "business_owner"
}

export async function getSignedInUser(
  ctx: QueryCtx | MutationCtx
): Promise<SignedInUser | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    return null
  }

  const user = await authComponent.safeGetAuthUser(ctx)
  if (!user?.email) {
    return null
  }

  return {
    tokenIdentifier: identity.tokenIdentifier,
    email: user.email,
    name: user.name ?? "",
    kind: kindForEmail(user.email),
  }
}

export async function requireSignedInUser(
  ctx: QueryCtx | MutationCtx
): Promise<SignedInUser> {
  const user = await getSignedInUser(ctx)
  if (!user) {
    throw new ConvexError("UNAUTHENTICATED")
  }
  return user
}

export const getCurrentUser = query({
  args: {},
  returns: v.union(signedInUser, v.null()),
  handler: async (ctx) => {
    return await getSignedInUser(ctx)
  },
})

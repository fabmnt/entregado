import { ConvexError, v } from "convex/values"
import { authComponent } from "./auth"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { query } from "./_generated/server"
import { userKind } from "./schema"

export const signedInUser = v.object({
  tokenIdentifier: v.string(),
  email: v.string(),
  name: v.string(),
  kind: userKind,
})

export type SignedInUser = {
  tokenIdentifier: string
  email: string
  name: string
  kind: "admin" | "business_owner"
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

  const profile = await ctx.db
    .query("users")
    .withIndex("by_auth_user", (q) => q.eq("authUserId", user._id))
    .unique()

  return {
    tokenIdentifier: identity.tokenIdentifier,
    email: user.email,
    name: user.name ?? "",
    kind: profile?.kind ?? "business_owner",
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

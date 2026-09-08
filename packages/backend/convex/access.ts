import { ConvexError } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { requireSignedInUser, type SignedInUser } from "./identity"

export function canManageBusiness(
  user: SignedInUser,
  business: Doc<"businesses">
): boolean {
  return (
    user.kind === "admin" ||
    business.ownerTokenIdentifier === user.tokenIdentifier
  )
}

export function isBusinessManagerKind(kind: SignedInUser["kind"]): boolean {
  return kind === "admin" || kind === "business_owner"
}

export async function requireBusinessBySlug(
  ctx: QueryCtx | MutationCtx,
  slug: string
): Promise<Doc<"businesses">> {
  const business = await ctx.db
    .query("businesses")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique()

  if (!business) {
    throw new ConvexError("NOT_FOUND")
  }

  return business
}

export async function requireManagedBusiness(
  ctx: QueryCtx | MutationCtx,
  slug: string
): Promise<Doc<"businesses">> {
  const user = await requireSignedInUser(ctx)
  const business = await requireBusinessBySlug(ctx, slug)

  if (!canManageBusiness(user, business)) {
    throw new ConvexError("FORBIDDEN")
  }

  return business
}

export async function requireRider(ctx: QueryCtx | MutationCtx): Promise<{
  user: SignedInUser
  rider: Doc<"users">
  business: Doc<"businesses">
}> {
  const user = await requireSignedInUser(ctx)
  if (user.kind !== "rider" || !user.profileId || !user.businessId) {
    throw new ConvexError("FORBIDDEN")
  }

  const rider = await ctx.db.get("users", user.profileId)
  if (
    !rider ||
    rider.kind !== "rider" ||
    rider.businessId !== user.businessId
  ) {
    throw new ConvexError("FORBIDDEN")
  }

  const business = await ctx.db.get("businesses", user.businessId)
  if (!business) {
    throw new ConvexError("FORBIDDEN")
  }

  return { user, rider, business }
}

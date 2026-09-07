import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import { mutation, type MutationCtx } from "./_generated/server"
import { requireSignedInUser } from "./identity"

export async function deleteStorageIfUnreferenced(
  ctx: MutationCtx,
  storageId: Id<"_storage">
): Promise<void> {
  const business = await ctx.db
    .query("businesses")
    .withIndex("by_logoStorageId", (q) => q.eq("logoStorageId", storageId))
    .first()
  if (business) {
    return
  }

  const product = await ctx.db
    .query("products")
    .withIndex("by_photoStorageId", (q) => q.eq("photoStorageId", storageId))
    .first()
  if (product) {
    return
  }

  await ctx.storage.delete(storageId)
}

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireSignedInUser(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

export const deleteIfUnreferenced = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSignedInUser(ctx)
    await deleteStorageIfUnreferenced(ctx, args.storageId)
    return null
  },
})

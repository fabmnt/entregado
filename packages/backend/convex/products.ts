import { ConvexError, v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { requireManagedBusiness } from "./access"
import { storeProduct } from "./schema"

const PRODUCT_LIST_LIMIT = 100

function assertPrice(price: number) {
  if (!Number.isFinite(price) || price < 0) {
    throw new ConvexError("INVALID_PRICE")
  }
}

async function toStoreProduct(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<"products">
) {
  return {
    id: doc._id,
    name: doc.name,
    description: doc.description,
    price: doc.price,
    available: doc.available,
    photoUrl: doc.photoStorageId
      ? await ctx.storage.getUrl(doc.photoStorageId)
      : null,
  }
}

export const listManaged = query({
  args: { slug: v.string() },
  returns: v.array(storeProduct),
  handler: async (ctx, args) => {
    const business = await requireManagedBusiness(ctx, args.slug)
    const rows = await ctx.db
      .query("products")
      .withIndex("by_businessId", (q) => q.eq("businessId", business._id))
      .order("desc")
      .take(PRODUCT_LIST_LIMIT)

    return await Promise.all(rows.map((row) => toStoreProduct(ctx, row)))
  },
})

export const getManaged = query({
  args: { slug: v.string(), productId: v.id("products") },
  returns: v.union(storeProduct, v.null()),
  handler: async (ctx, args) => {
    const business = await requireManagedBusiness(ctx, args.slug)
    const product = await ctx.db.get("products", args.productId)
    if (!product || product.businessId !== business._id) {
      return null
    }
    return await toStoreProduct(ctx, product)
  },
})

export const create = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    description: v.string(),
    price: v.number(),
    available: v.boolean(),
    photoStorageId: v.optional(v.id("_storage")),
  },
  returns: storeProduct,
  handler: async (ctx, args) => {
    const business = await requireManagedBusiness(ctx, args.slug)
    assertPrice(args.price)

    const id = await ctx.db.insert("products", {
      businessId: business._id,
      name: args.name,
      description: args.description,
      price: args.price,
      available: args.available,
      photoStorageId: args.photoStorageId,
    })
    const row = await ctx.db.get("products", id)
    if (!row) {
      throw new Error("Insert did not persist the product")
    }
    return await toStoreProduct(ctx, row)
  },
})

export const update = mutation({
  args: {
    slug: v.string(),
    productId: v.id("products"),
    name: v.string(),
    description: v.string(),
    price: v.number(),
    available: v.boolean(),
    photoStorageId: v.optional(v.id("_storage")),
    clearPhoto: v.boolean(),
  },
  returns: storeProduct,
  handler: async (ctx, args) => {
    const business = await requireManagedBusiness(ctx, args.slug)
    const product = await ctx.db.get("products", args.productId)
    if (!product || product.businessId !== business._id) {
      throw new ConvexError("NOT_FOUND")
    }
    assertPrice(args.price)

    let nextPhoto = product.photoStorageId
    if (args.clearPhoto) {
      if (product.photoStorageId) {
        await ctx.storage.delete(product.photoStorageId)
      }
      nextPhoto = undefined
    } else if (args.photoStorageId) {
      if (
        product.photoStorageId &&
        product.photoStorageId !== args.photoStorageId
      ) {
        await ctx.storage.delete(product.photoStorageId)
      }
      nextPhoto = args.photoStorageId
    }

    await ctx.db.replace("products", product._id, {
      businessId: product.businessId,
      name: args.name,
      description: args.description,
      price: args.price,
      available: args.available,
      ...(nextPhoto ? { photoStorageId: nextPhoto } : {}),
    })

    const row = await ctx.db.get("products", product._id)
    if (!row) {
      throw new Error("Update did not persist the product")
    }
    return await toStoreProduct(ctx, row)
  },
})

export const remove = mutation({
  args: {
    slug: v.string(),
    productId: v.id("products"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const business = await requireManagedBusiness(ctx, args.slug)
    const product = await ctx.db.get("products", args.productId)
    if (!product || product.businessId !== business._id) {
      throw new ConvexError("NOT_FOUND")
    }
    if (product.photoStorageId) {
      await ctx.storage.delete(product.photoStorageId)
    }
    await ctx.db.delete("products", product._id)
    return null
  },
})

import { ConvexError, v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import type { QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import {
  requireBusinessBySlug,
  requireManagedBusiness,
  requireRider,
} from "./access"
import { parseNicaraguaE164 } from "./phone"
import { productSupportsDelivery } from "./products"
import { fulfillmentMode, saleView } from "./schema"

const SALE_LIST_LIMIT = 100
const MAX_QUANTITY = 99
const BUYER_NAME_MAX = 80
const BUYER_LOCATION_MAX = 500

function toSaleView(doc: Doc<"sales">) {
  return {
    id: doc._id,
    productName: doc.productName,
    quantity: doc.quantity,
    unitPrice: doc.unitPrice,
    totalPrice: doc.unitPrice * doc.quantity,
    buyerName: doc.buyerName,
    buyerPhone: doc.buyerPhone,
    buyerLocation: doc.buyerLocation ?? null,
    fulfillment: doc.fulfillment,
    status: doc.status,
    riderName: doc.riderName ?? null,
    createdAt: new Date(doc._creationTime).toISOString(),
  }
}

function assertQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new ConvexError("INVALID_QUANTITY")
  }
}

function optionalLocation(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : undefined
}

function assertOpenSale(sale: Doc<"sales">) {
  if (sale.status === "completed" || sale.status === "cancelled") {
    throw new ConvexError("SALE_NOT_OPEN")
  }
}

// Public receipts are unauthenticated, so hide buyer PII. Only the last
// 4 digits are shown for confirmation; the location stays owner-only.
function maskBuyerPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  const last4 = digits.slice(-4)
  if (last4.length === 0) {
    return "****"
  }
  return `**** ${last4}`
}

function toPublicSaleView(doc: Doc<"sales">) {
  const view = toSaleView(doc)
  return {
    ...view,
    buyerPhone: maskBuyerPhone(view.buyerPhone),
    buyerLocation: null,
  }
}

async function listByFulfillmentAndStatus(
  ctx: QueryCtx,
  businessId: Id<"businesses">,
  fulfillment: Doc<"sales">["fulfillment"],
  status: Doc<"sales">["status"]
) {
  return await ctx.db
    .query("sales")
    .withIndex("by_businessId_and_fulfillment_and_status", (q) =>
      q
        .eq("businessId", businessId)
        .eq("fulfillment", fulfillment)
        .eq("status", status)
    )
    .order("desc")
    .take(SALE_LIST_LIMIT)
}

export const getPublic = query({
  args: { slug: v.string(), saleId: v.id("sales") },
  returns: v.union(saleView, v.null()),
  handler: async (ctx, args) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()
    if (!business) {
      return null
    }

    const sale = await ctx.db.get("sales", args.saleId)
    if (!sale || sale.businessId !== business._id) {
      return null
    }
    return toPublicSaleView(sale)
  },
})

export const listManaged = query({
  args: { slug: v.string() },
  returns: v.object({
    open: v.array(saleView),
    recent: v.array(saleView),
  }),
  handler: async (ctx, args) => {
    const business = await requireManagedBusiness(ctx, args.slug)
    const openRows = (
      await Promise.all([
        listByFulfillmentAndStatus(ctx, business._id, "delivery", "pending"),
        listByFulfillmentAndStatus(ctx, business._id, "pickup", "pending"),
        listByFulfillmentAndStatus(ctx, business._id, "delivery", "accepted"),
        listByFulfillmentAndStatus(ctx, business._id, "pickup", "accepted"),
      ])
    )
      .flat()
      .sort((a, b) => b._creationTime - a._creationTime)

    const recentRows = (
      await Promise.all([
        listByFulfillmentAndStatus(ctx, business._id, "delivery", "completed"),
        listByFulfillmentAndStatus(ctx, business._id, "pickup", "completed"),
        listByFulfillmentAndStatus(ctx, business._id, "delivery", "cancelled"),
        listByFulfillmentAndStatus(ctx, business._id, "pickup", "cancelled"),
      ])
    )
      .flat()
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, SALE_LIST_LIMIT)

    return {
      open: openRows.map(toSaleView),
      recent: recentRows.map(toSaleView),
    }
  },
})

export const listForRider = query({
  args: {},
  returns: v.object({
    businessName: v.string(),
    current: v.union(saleView, v.null()),
    recommendedId: v.union(v.id("sales"), v.null()),
    pending: v.array(saleView),
  }),
  handler: async (ctx) => {
    const { rider, business } = await requireRider(ctx)

    const accepted = await ctx.db
      .query("sales")
      .withIndex("by_riderUserId_and_status", (q) =>
        q.eq("riderUserId", rider._id).eq("status", "accepted")
      )
      .take(1)

    const pendingRows = await ctx.db
      .query("sales")
      .withIndex("by_businessId_and_fulfillment_and_status", (q) =>
        q
          .eq("businessId", business._id)
          .eq("fulfillment", "delivery")
          .eq("status", "pending")
      )
      .order("asc")
      .take(SALE_LIST_LIMIT)

    return {
      businessName: business.name,
      current: accepted[0] ? toSaleView(accepted[0]) : null,
      recommendedId: pendingRows[0]?._id ?? null,
      pending: pendingRows.map(toSaleView),
    }
  },
})

export const create = mutation({
  args: {
    slug: v.string(),
    productId: v.id("products"),
    quantity: v.number(),
    buyerName: v.string(),
    buyerPhone: v.string(),
    buyerLocation: v.optional(v.string()),
    fulfillment: fulfillmentMode,
  },
  returns: saleView,
  handler: async (ctx, args) => {
    const business = await requireBusinessBySlug(ctx, args.slug)
    const product = await ctx.db.get("products", args.productId)
    if (!product || product.businessId !== business._id || !product.available) {
      throw new ConvexError("NOT_FOUND")
    }

    assertQuantity(args.quantity)

    const buyerName = args.buyerName.trim()
    if (buyerName.length === 0 || buyerName.length > BUYER_NAME_MAX) {
      throw new ConvexError("INVALID_BUYER_NAME")
    }

    const buyerPhone = parseNicaraguaE164(args.buyerPhone)
    const wantsDelivery = args.fulfillment === "delivery"
    if (wantsDelivery && !productSupportsDelivery(product)) {
      throw new ConvexError("DELIVERY_NOT_AVAILABLE")
    }

    const buyerLocation = optionalLocation(args.buyerLocation)
    if (wantsDelivery) {
      if (!buyerLocation || buyerLocation.length > BUYER_LOCATION_MAX) {
        throw new ConvexError("INVALID_LOCATION")
      }
    }

    const id = await ctx.db.insert("sales", {
      businessId: business._id,
      productId: product._id,
      productName: product.name,
      unitPrice: product.price,
      quantity: args.quantity,
      buyerName,
      buyerPhone,
      ...(wantsDelivery && buyerLocation ? { buyerLocation } : {}),
      fulfillment: wantsDelivery ? "delivery" : "pickup",
      status: "pending",
    })
    const row = await ctx.db.get("sales", id)
    if (!row) {
      throw new Error("Insert did not persist the sale")
    }
    return toSaleView(row)
  },
})

export const accept = mutation({
  args: { saleId: v.id("sales") },
  returns: saleView,
  handler: async (ctx, args) => {
    const { user, rider, business } = await requireRider(ctx)
    const sale = await ctx.db.get("sales", args.saleId)
    if (!sale || sale.businessId !== business._id) {
      throw new ConvexError("NOT_FOUND")
    }
    if (sale.fulfillment !== "delivery" || sale.status !== "pending") {
      throw new ConvexError("SALE_NOT_AVAILABLE")
    }

    const alreadyAccepted = await ctx.db
      .query("sales")
      .withIndex("by_riderUserId_and_status", (q) =>
        q.eq("riderUserId", rider._id).eq("status", "accepted")
      )
      .take(1)
    if (alreadyAccepted.length > 0) {
      throw new ConvexError("HAS_ACTIVE_SALE")
    }

    const riderName = user.name.trim() || rider.name || user.email
    await ctx.db.patch("sales", sale._id, {
      status: "accepted",
      riderUserId: rider._id,
      riderName,
    })
    const row = await ctx.db.get("sales", sale._id)
    if (!row) {
      throw new Error("Update did not persist the sale")
    }
    return toSaleView(row)
  },
})

export const completeAsRider = mutation({
  args: { saleId: v.id("sales") },
  returns: saleView,
  handler: async (ctx, args) => {
    const { rider, business } = await requireRider(ctx)
    const sale = await ctx.db.get("sales", args.saleId)
    if (!sale || sale.businessId !== business._id) {
      throw new ConvexError("NOT_FOUND")
    }
    if (sale.status !== "accepted" || sale.riderUserId !== rider._id) {
      throw new ConvexError("SALE_NOT_AVAILABLE")
    }

    await ctx.db.patch("sales", sale._id, {
      status: "completed",
      completedAt: Date.now(),
    })
    const row = await ctx.db.get("sales", sale._id)
    if (!row) {
      throw new Error("Update did not persist the sale")
    }
    return toSaleView(row)
  },
})

export const completeAsOwner = mutation({
  args: { slug: v.string(), saleId: v.id("sales") },
  returns: saleView,
  handler: async (ctx, args) => {
    const business = await requireManagedBusiness(ctx, args.slug)
    const sale = await ctx.db.get("sales", args.saleId)
    if (!sale || sale.businessId !== business._id) {
      throw new ConvexError("NOT_FOUND")
    }
    if (sale.fulfillment !== "pickup") {
      throw new ConvexError("SALE_NOT_AVAILABLE")
    }
    assertOpenSale(sale)

    await ctx.db.patch("sales", sale._id, {
      status: "completed",
      completedAt: Date.now(),
    })
    const row = await ctx.db.get("sales", sale._id)
    if (!row) {
      throw new Error("Update did not persist the sale")
    }
    return toSaleView(row)
  },
})

export const cancelAsOwner = mutation({
  args: { slug: v.string(), saleId: v.id("sales") },
  returns: saleView,
  handler: async (ctx, args) => {
    const business = await requireManagedBusiness(ctx, args.slug)
    const sale = await ctx.db.get("sales", args.saleId)
    if (!sale || sale.businessId !== business._id) {
      throw new ConvexError("NOT_FOUND")
    }
    assertOpenSale(sale)

    await ctx.db.patch("sales", sale._id, {
      status: "cancelled",
      cancelledAt: Date.now(),
    })
    const row = await ctx.db.get("sales", sale._id)
    if (!row) {
      throw new Error("Update did not persist the sale")
    }
    return toSaleView(row)
  },
})

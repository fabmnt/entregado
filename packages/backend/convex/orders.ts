import { ConvexError, v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import {
  requireBusinessBySlug,
  requireManagedBusiness,
  requireRider,
} from "./access"
import { parseNicaraguaE164 } from "./phone"
import { productSupportsDelivery } from "./products"
import { fulfillmentMode, orderView } from "./schema"

const ORDER_LIST_LIMIT = 100
const MAX_ITEM_QUANTITY = 99
const MAX_ORDER_ITEMS = 50
const BUYER_NAME_MAX = 80
const BUYER_LOCATION_MAX = 500

const orderItemInput = v.object({
  productId: v.id("products"),
  quantity: v.number(),
})

type OrderItemDraft = {
  productId: Id<"products">
  productName: string
  unitPrice: number
  quantity: number
}

async function listOrderItems(
  ctx: QueryCtx | MutationCtx,
  orderId: Id<"orders">
) {
  return await ctx.db
    .query("orderItems")
    .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
    .take(MAX_ORDER_ITEMS)
}

async function toOrderView(ctx: QueryCtx | MutationCtx, doc: Doc<"orders">) {
  const items = await listOrderItems(ctx, doc._id)
  return {
    id: doc._id,
    items: items.map((item) => ({
      id: item._id,
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
    })),
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    totalPrice: doc.totalPrice,
    buyerName: doc.buyerName,
    buyerPhone: doc.buyerPhone,
    buyerLocation: doc.buyerLocation ?? null,
    fulfillment: doc.fulfillment,
    status: doc.status,
    riderName: doc.riderName ?? null,
    createdAt: new Date(doc._creationTime).toISOString(),
  }
}

async function listOrderViews(
  ctx: QueryCtx | MutationCtx,
  docs: Doc<"orders">[]
) {
  return await Promise.all(docs.map((doc) => toOrderView(ctx, doc)))
}

function optionalLocation(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : undefined
}

function assertOpenOrder(order: Doc<"orders">) {
  if (order.status === "completed" || order.status === "cancelled") {
    throw new ConvexError("ORDER_NOT_OPEN")
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

function toPublicOrderView(order: Awaited<ReturnType<typeof toOrderView>>) {
  return {
    ...order,
    buyerPhone: maskBuyerPhone(order.buyerPhone),
    buyerLocation: null,
  }
}

// Prices, names and the total come from the products table, never from the
// client. Duplicate product lines are merged so one product is one line.
async function resolveOrderItems(
  ctx: MutationCtx,
  businessId: Id<"businesses">,
  inputs: { productId: Id<"products">; quantity: number }[],
  wantsDelivery: boolean
): Promise<OrderItemDraft[]> {
  if (inputs.length === 0 || inputs.length > MAX_ORDER_ITEMS) {
    throw new ConvexError("INVALID_ITEMS")
  }

  const quantities = new Map<Id<"products">, number>()
  for (const input of inputs) {
    if (
      !Number.isInteger(input.quantity) ||
      input.quantity < 1 ||
      input.quantity > MAX_ITEM_QUANTITY
    ) {
      throw new ConvexError("INVALID_QUANTITY")
    }

    const merged = (quantities.get(input.productId) ?? 0) + input.quantity
    if (merged > MAX_ITEM_QUANTITY) {
      throw new ConvexError("INVALID_QUANTITY")
    }
    quantities.set(input.productId, merged)
  }

  const items: OrderItemDraft[] = []
  for (const [productId, quantity] of quantities) {
    const product = await ctx.db.get("products", productId)
    if (!product || product.businessId !== businessId || !product.available) {
      throw new ConvexError("NOT_FOUND")
    }
    if (wantsDelivery && !productSupportsDelivery(product)) {
      throw new ConvexError("DELIVERY_NOT_AVAILABLE")
    }

    items.push({
      productId: product._id,
      productName: product.name,
      unitPrice: product.price,
      quantity,
    })
  }

  return items
}

async function listByFulfillmentAndStatus(
  ctx: QueryCtx,
  businessId: Id<"businesses">,
  fulfillment: Doc<"orders">["fulfillment"],
  status: Doc<"orders">["status"]
) {
  return await ctx.db
    .query("orders")
    .withIndex("by_businessId_and_fulfillment_and_status", (q) =>
      q
        .eq("businessId", businessId)
        .eq("fulfillment", fulfillment)
        .eq("status", status)
    )
    .order("desc")
    .take(ORDER_LIST_LIMIT)
}

export const getPublic = query({
  args: { slug: v.string(), orderId: v.id("orders") },
  returns: v.union(orderView, v.null()),
  handler: async (ctx, args) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()
    if (!business) {
      return null
    }

    const order = await ctx.db.get("orders", args.orderId)
    if (!order || order.businessId !== business._id) {
      return null
    }
    return toPublicOrderView(await toOrderView(ctx, order))
  },
})

export const listManaged = query({
  args: { slug: v.string() },
  returns: v.object({
    open: v.array(orderView),
    recent: v.array(orderView),
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
      .slice(0, ORDER_LIST_LIMIT)

    return {
      open: await listOrderViews(ctx, openRows),
      recent: await listOrderViews(ctx, recentRows),
    }
  },
})

export const listForRider = query({
  args: {},
  returns: v.object({
    businessName: v.string(),
    current: v.union(orderView, v.null()),
    recommendedId: v.union(v.id("orders"), v.null()),
    pending: v.array(orderView),
  }),
  handler: async (ctx) => {
    const { rider, business } = await requireRider(ctx)

    const accepted = await ctx.db
      .query("orders")
      .withIndex("by_riderUserId_and_status", (q) =>
        q.eq("riderUserId", rider._id).eq("status", "accepted")
      )
      .take(1)

    const pendingRows = await ctx.db
      .query("orders")
      .withIndex("by_businessId_and_fulfillment_and_status", (q) =>
        q
          .eq("businessId", business._id)
          .eq("fulfillment", "delivery")
          .eq("status", "pending")
      )
      .order("asc")
      .take(ORDER_LIST_LIMIT)

    return {
      businessName: business.name,
      current: accepted[0] ? await toOrderView(ctx, accepted[0]) : null,
      recommendedId: pendingRows[0]?._id ?? null,
      pending: await listOrderViews(ctx, pendingRows),
    }
  },
})

export const create = mutation({
  args: {
    slug: v.string(),
    items: v.array(orderItemInput),
    buyerName: v.string(),
    buyerPhone: v.string(),
    buyerLocation: v.optional(v.string()),
    fulfillment: fulfillmentMode,
  },
  returns: orderView,
  handler: async (ctx, args) => {
    const business = await requireBusinessBySlug(ctx, args.slug)

    const buyerName = args.buyerName.trim()
    if (buyerName.length === 0 || buyerName.length > BUYER_NAME_MAX) {
      throw new ConvexError("INVALID_BUYER_NAME")
    }

    const buyerPhone = parseNicaraguaE164(args.buyerPhone)
    const wantsDelivery = args.fulfillment === "delivery"

    const buyerLocation = optionalLocation(args.buyerLocation)
    if (wantsDelivery) {
      if (!buyerLocation || buyerLocation.length > BUYER_LOCATION_MAX) {
        throw new ConvexError("INVALID_LOCATION")
      }
    }

    const items = await resolveOrderItems(
      ctx,
      business._id,
      args.items,
      wantsDelivery
    )
    const totalPrice = items.reduce(
      (total, item) => total + item.unitPrice * item.quantity,
      0
    )

    const id = await ctx.db.insert("orders", {
      businessId: business._id,
      buyerName,
      buyerPhone,
      ...(wantsDelivery && buyerLocation ? { buyerLocation } : {}),
      fulfillment: wantsDelivery ? "delivery" : "pickup",
      status: "pending",
      totalPrice,
    })
    for (const item of items) {
      await ctx.db.insert("orderItems", { orderId: id, ...item })
    }

    const row = await ctx.db.get("orders", id)
    if (!row) {
      throw new Error("Insert did not persist the order")
    }
    return await toOrderView(ctx, row)
  },
})

export const accept = mutation({
  args: { orderId: v.id("orders") },
  returns: orderView,
  handler: async (ctx, args) => {
    const { user, rider, business } = await requireRider(ctx)
    const order = await ctx.db.get("orders", args.orderId)
    if (!order || order.businessId !== business._id) {
      throw new ConvexError("NOT_FOUND")
    }
    if (order.fulfillment !== "delivery" || order.status !== "pending") {
      throw new ConvexError("ORDER_NOT_AVAILABLE")
    }

    const alreadyAccepted = await ctx.db
      .query("orders")
      .withIndex("by_riderUserId_and_status", (q) =>
        q.eq("riderUserId", rider._id).eq("status", "accepted")
      )
      .take(1)
    if (alreadyAccepted.length > 0) {
      throw new ConvexError("HAS_ACTIVE_ORDER")
    }

    const riderName = user.name.trim() || rider.name || user.email
    await ctx.db.patch("orders", order._id, {
      status: "accepted",
      riderUserId: rider._id,
      riderName,
    })
    const row = await ctx.db.get("orders", order._id)
    if (!row) {
      throw new Error("Update did not persist the order")
    }
    return await toOrderView(ctx, row)
  },
})

export const completeAsRider = mutation({
  args: { orderId: v.id("orders") },
  returns: orderView,
  handler: async (ctx, args) => {
    const { rider, business } = await requireRider(ctx)
    const order = await ctx.db.get("orders", args.orderId)
    if (!order || order.businessId !== business._id) {
      throw new ConvexError("NOT_FOUND")
    }
    if (order.status !== "accepted" || order.riderUserId !== rider._id) {
      throw new ConvexError("ORDER_NOT_AVAILABLE")
    }

    await ctx.db.patch("orders", order._id, {
      status: "completed",
      completedAt: Date.now(),
    })
    const row = await ctx.db.get("orders", order._id)
    if (!row) {
      throw new Error("Update did not persist the order")
    }
    return await toOrderView(ctx, row)
  },
})

export const completeAsOwner = mutation({
  args: { slug: v.string(), orderId: v.id("orders") },
  returns: orderView,
  handler: async (ctx, args) => {
    const business = await requireManagedBusiness(ctx, args.slug)
    const order = await ctx.db.get("orders", args.orderId)
    if (!order || order.businessId !== business._id) {
      throw new ConvexError("NOT_FOUND")
    }
    if (order.fulfillment !== "pickup") {
      throw new ConvexError("ORDER_NOT_AVAILABLE")
    }
    assertOpenOrder(order)

    await ctx.db.patch("orders", order._id, {
      status: "completed",
      completedAt: Date.now(),
    })
    const row = await ctx.db.get("orders", order._id)
    if (!row) {
      throw new Error("Update did not persist the order")
    }
    return await toOrderView(ctx, row)
  },
})

export const cancelAsOwner = mutation({
  args: { slug: v.string(), orderId: v.id("orders") },
  returns: orderView,
  handler: async (ctx, args) => {
    const business = await requireManagedBusiness(ctx, args.slug)
    const order = await ctx.db.get("orders", args.orderId)
    if (!order || order.businessId !== business._id) {
      throw new ConvexError("NOT_FOUND")
    }
    assertOpenOrder(order)

    await ctx.db.patch("orders", order._id, {
      status: "cancelled",
      cancelledAt: Date.now(),
    })
    const row = await ctx.db.get("orders", order._id)
    if (!row) {
      throw new Error("Update did not persist the order")
    }
    return await toOrderView(ctx, row)
  },
})

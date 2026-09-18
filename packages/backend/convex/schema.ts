import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

// Shared platform database. Many businesses share these tables; isolate
// tenant data with owner, slug, or business id. Do not add a Convex app
// per business.

export const businessKind = v.union(v.literal("food"), v.literal("pharmacy"))
export const userKind = v.union(
  v.literal("admin"),
  v.literal("business_owner"),
  v.literal("rider")
)
export const orderStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("completed"),
  v.literal("cancelled")
)
export const fulfillmentMode = v.union(
  v.literal("delivery"),
  v.literal("pickup")
)
export const paymentMethod = v.union(
  v.literal("cash_on_delivery"),
  v.literal("transfer")
)
export const paymentStatus = v.union(v.literal("pending"), v.literal("paid"))

export const businessFields = v.object({
  slug: v.string(),
  name: v.string(),
  kind: businessKind,
  description: v.string(),
  advantages: v.string(),
  scope: v.string(),
  productPitch: v.string(),
  whatsapp: v.optional(v.string()),
  phone: v.optional(v.string()),
  address: v.optional(v.string()),
  hours: v.optional(v.string()),
  logoStorageId: v.optional(v.id("_storage")),
  ownerTokenIdentifier: v.optional(v.string()),
  suspendedAt: v.optional(v.number()),
  suspensionReason: v.optional(v.string()),
})

export const directoryBusiness = v.object({
  id: v.id("businesses"),
  slug: v.string(),
  name: v.string(),
  kind: businessKind,
  description: v.string(),
  advantages: v.string(),
  scope: v.string(),
  productPitch: v.string(),
  logoUrl: v.union(v.string(), v.null()),
  createdAt: v.string(),
})

export const managedBusiness = directoryBusiness.extend({
  whatsapp: v.optional(v.string()),
  phone: v.optional(v.string()),
  address: v.optional(v.string()),
  hours: v.optional(v.string()),
  suspendedAt: v.union(v.number(), v.null()),
  suspensionReason: v.union(v.string(), v.null()),
})

export const storeProduct = v.object({
  id: v.id("products"),
  name: v.string(),
  description: v.string(),
  price: v.number(),
  available: v.boolean(),
  supportsDelivery: v.boolean(),
  photoUrl: v.union(v.string(), v.null()),
})

export const storefront = v.object({
  business: managedBusiness,
  products: v.array(storeProduct),
})

export const productFields = v.object({
  businessId: v.id("businesses"),
  name: v.string(),
  description: v.string(),
  price: v.number(),
  available: v.boolean(),
  supportsDelivery: v.optional(v.boolean()),
  photoStorageId: v.optional(v.id("_storage")),
})

export const orderItemView = v.object({
  id: v.id("orderItems"),
  productId: v.id("products"),
  productName: v.string(),
  unitPrice: v.number(),
  quantity: v.number(),
})

export const orderView = v.object({
  id: v.id("orders"),
  items: v.array(orderItemView),
  // Units across every item, so boards show a count without reading the lines.
  itemCount: v.number(),
  totalPrice: v.number(),
  buyerName: v.string(),
  buyerPhone: v.string(),
  buyerLocation: v.union(v.string(), v.null()),
  fulfillment: fulfillmentMode,
  status: orderStatus,
  paymentMethod: v.union(paymentMethod, v.null()),
  paymentStatus: paymentStatus,
  riderName: v.union(v.string(), v.null()),
  createdAt: v.string(),
})

// Buyer-facing receipt view. Adds the close-out timestamps the tracking page
// needs; PII stays masked by the query that returns it.
export const publicOrderView = orderView.extend({
  completedAt: v.union(v.number(), v.null()),
  cancelledAt: v.union(v.number(), v.null()),
})

export const riderView = v.object({
  id: v.id("users"),
  name: v.string(),
  email: v.string(),
  active: v.boolean(),
})

export default defineSchema({
  users: defineTable({
    authUserId: v.string(),
    kind: userKind,
    businessId: v.optional(v.id("businesses")),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    // Riders created before this flag existed have no value and count as active.
    active: v.optional(v.boolean()),
  })
    .index("by_auth_user", ["authUserId"])
    .index("by_kind", ["kind"])
    .index("by_businessId", ["businessId"])
    .index("by_businessId_and_kind", ["businessId", "kind"]),
  businesses: defineTable(businessFields)
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerTokenIdentifier"])
    .index("by_logoStorageId", ["logoStorageId"])
    .index("by_suspendedAt", ["suspendedAt"]),
  products: defineTable(productFields)
    .index("by_businessId", ["businessId"])
    .index("by_businessId_and_available", ["businessId", "available"])
    .index("by_photoStorageId", ["photoStorageId"]),
  orders: defineTable({
    businessId: v.id("businesses"),
    buyerName: v.string(),
    buyerPhone: v.string(),
    buyerLocation: v.optional(v.string()),
    fulfillment: fulfillmentMode,
    status: orderStatus,
    open: v.boolean(),
    totalPrice: v.number(),
    paymentMethod: v.optional(paymentMethod),
    paymentStatus: v.optional(paymentStatus),
    paidAt: v.optional(v.number()),
    riderUserId: v.optional(v.id("users")),
    riderName: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
  })
    .index("by_businessId", ["businessId"])
    .index("by_businessId_and_open", ["businessId", "open"])
    .index("by_businessId_and_fulfillment_and_status", [
      "businessId",
      "fulfillment",
      "status",
    ])
    .index("by_riderUserId_and_status", ["riderUserId", "status"]),
  orderItems: defineTable({
    orderId: v.id("orders"),
    productId: v.id("products"),
    productName: v.string(),
    unitPrice: v.number(),
    quantity: v.number(),
  }).index("by_orderId", ["orderId"]),
})

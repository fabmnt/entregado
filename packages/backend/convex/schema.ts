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
  riderName: v.union(v.string(), v.null()),
  createdAt: v.string(),
})

export const riderView = v.object({
  id: v.id("users"),
  name: v.string(),
  email: v.string(),
})

export default defineSchema({
  users: defineTable({
    authUserId: v.string(),
    kind: userKind,
    businessId: v.optional(v.id("businesses")),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  })
    .index("by_auth_user", ["authUserId"])
    .index("by_kind", ["kind"])
    .index("by_businessId", ["businessId"]),
  businesses: defineTable(businessFields)
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerTokenIdentifier"])
    .index("by_logoStorageId", ["logoStorageId"]),
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
    totalPrice: v.number(),
    riderUserId: v.optional(v.id("users")),
    riderName: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
  })
    .index("by_businessId", ["businessId"])
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

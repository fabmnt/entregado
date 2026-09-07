import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

// Shared platform database. Many businesses share these tables; isolate
// tenant data with owner, slug, or business id. Do not add a Convex app
// per business.

export const businessKind = v.union(v.literal("food"), v.literal("pharmacy"))
export const userKind = v.union(v.literal("admin"), v.literal("business_owner"))

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
  photoStorageId: v.optional(v.id("_storage")),
})

export default defineSchema({
  users: defineTable({
    authUserId: v.string(),
    kind: userKind,
  })
    .index("by_auth_user", ["authUserId"])
    .index("by_kind", ["kind"]),
  businesses: defineTable(businessFields)
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerTokenIdentifier"]),
  products: defineTable(productFields).index("by_businessId", ["businessId"]),
})

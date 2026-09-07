import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export const businessKind = v.union(v.literal("food"), v.literal("pharmacy"))

export const businessFields = v.object({
  slug: v.string(),
  name: v.string(),
  kind: businessKind,
  description: v.string(),
  advantages: v.string(),
  scope: v.string(),
  productPitch: v.string(),
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
  createdAt: v.string(),
})

export default defineSchema({
  businesses: defineTable(businessFields)
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerTokenIdentifier"]),
})

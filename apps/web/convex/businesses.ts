import { ConvexError, v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import { businessFields, directoryBusiness } from "./schema"

const DIRECTORY_LIST_LIMIT = 100

function toDirectoryBusiness(doc: Doc<"businesses">) {
  return {
    id: doc._id,
    slug: doc.slug,
    name: doc.name,
    kind: doc.kind,
    description: doc.description,
    advantages: doc.advantages,
    scope: doc.scope,
    productPitch: doc.productPitch,
    createdAt: new Date(doc._creationTime).toISOString(),
  }
}

export const list = query({
  args: {},
  returns: v.array(directoryBusiness),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("businesses")
      .order("desc")
      .take(DIRECTORY_LIST_LIMIT)
    return rows.map(toDirectoryBusiness)
  },
})

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(directoryBusiness, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()
    return row ? toDirectoryBusiness(row) : null
  },
})

export const create = mutation({
  args: businessFields.fields,
  returns: directoryBusiness,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()

    if (existing) {
      throw new ConvexError("SLUG_TAKEN")
    }

    const id = await ctx.db.insert("businesses", args)
    const row = await ctx.db.get("businesses", id)
    if (!row) {
      throw new Error("Insert did not persist the business")
    }
    return toDirectoryBusiness(row)
  },
})

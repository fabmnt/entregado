import { ConvexError, v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { requireManagedBusiness } from "./access"
import { requireSignedInUser } from "./identity"
import { parseNicaraguaE164 } from "./phone"
import {
  businessKind,
  directoryBusiness,
  managedBusiness,
  storefront,
} from "./schema"

const DIRECTORY_LIST_LIMIT = 100
const RESERVED_SLUGS = new Set(["login", "register", "logout", "admin", "api"])

const createArgs = v.object({
  slug: v.string(),
  name: v.string(),
  kind: businessKind,
  description: v.string(),
  advantages: v.string(),
  scope: v.string(),
  productPitch: v.string(),
  whatsapp: v.string(),
  logoStorageId: v.optional(v.id("_storage")),
})

const updateProfileArgs = v.object({
  slug: v.string(),
  name: v.string(),
  description: v.string(),
  advantages: v.string(),
  scope: v.string(),
  productPitch: v.string(),
  whatsapp: v.string(),
  phone: v.string(),
  address: v.string(),
  hours: v.string(),
  logoStorageId: v.optional(v.id("_storage")),
  clearLogo: v.boolean(),
})

async function logoUrlFor(
  ctx: QueryCtx | MutationCtx,
  logoStorageId: Doc<"businesses">["logoStorageId"]
): Promise<string | null> {
  if (!logoStorageId) {
    return null
  }
  return await ctx.storage.getUrl(logoStorageId)
}

async function toDirectoryBusiness(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<"businesses">
) {
  return {
    id: doc._id,
    slug: doc.slug,
    name: doc.name,
    kind: doc.kind,
    description: doc.description,
    advantages: doc.advantages,
    scope: doc.scope,
    productPitch: doc.productPitch,
    logoUrl: await logoUrlFor(ctx, doc.logoStorageId),
    createdAt: new Date(doc._creationTime).toISOString(),
  }
}

async function toManagedBusiness(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<"businesses">
) {
  const directory = await toDirectoryBusiness(ctx, doc)
  return {
    ...directory,
    whatsapp: doc.whatsapp,
    phone: doc.phone,
    address: doc.address,
    hours: doc.hours,
  }
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const list = query({
  args: {},
  returns: v.array(directoryBusiness),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("businesses")
      .order("desc")
      .take(DIRECTORY_LIST_LIMIT)
    return await Promise.all(rows.map((row) => toDirectoryBusiness(ctx, row)))
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
    return row ? await toDirectoryBusiness(ctx, row) : null
  },
})

export const getStoreBySlug = query({
  args: { slug: v.string() },
  returns: v.union(storefront, v.null()),
  handler: async (ctx, args) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()

    if (!business) {
      return null
    }

    const productRows = await ctx.db
      .query("products")
      .withIndex("by_businessId", (q) => q.eq("businessId", business._id))
      .order("desc")
      .take(DIRECTORY_LIST_LIMIT)

    const products = []
    for (const product of productRows) {
      if (!product.available) {
        continue
      }
      products.push({
        id: product._id,
        name: product.name,
        description: product.description,
        price: product.price,
        available: product.available,
        photoUrl: product.photoStorageId
          ? await ctx.storage.getUrl(product.photoStorageId)
          : null,
      })
    }

    return {
      business: await toManagedBusiness(ctx, business),
      products,
    }
  },
})

export const listForSignedIn = query({
  args: {},
  returns: v.array(directoryBusiness),
  handler: async (ctx) => {
    const user = await requireSignedInUser(ctx)

    if (user.kind === "admin") {
      const rows = await ctx.db
        .query("businesses")
        .order("desc")
        .take(DIRECTORY_LIST_LIMIT)
      return await Promise.all(rows.map((row) => toDirectoryBusiness(ctx, row)))
    }

    const rows = await ctx.db
      .query("businesses")
      .withIndex("by_owner", (q) =>
        q.eq("ownerTokenIdentifier", user.tokenIdentifier)
      )
      .order("desc")
      .take(DIRECTORY_LIST_LIMIT)
    return await Promise.all(rows.map((row) => toDirectoryBusiness(ctx, row)))
  },
})

export const getManagedBySlug = query({
  args: { slug: v.string() },
  returns: v.union(managedBusiness, v.null()),
  handler: async (ctx, args) => {
    try {
      const business = await requireManagedBusiness(ctx, args.slug)
      return await toManagedBusiness(ctx, business)
    } catch (error) {
      if (
        error instanceof ConvexError &&
        (error.data === "NOT_FOUND" || error.data === "FORBIDDEN")
      ) {
        return null
      }
      throw error
    }
  },
})

export const create = mutation({
  args: createArgs.fields,
  returns: directoryBusiness,
  handler: async (ctx, args) => {
    const user = await requireSignedInUser(ctx)

    if (RESERVED_SLUGS.has(args.slug)) {
      throw new ConvexError("SLUG_RESERVED")
    }

    const existing = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()

    if (existing) {
      throw new ConvexError("SLUG_TAKEN")
    }

    const whatsapp = parseNicaraguaE164(args.whatsapp)

    const id = await ctx.db.insert("businesses", {
      slug: args.slug,
      name: args.name,
      kind: args.kind,
      description: args.description,
      advantages: args.advantages,
      scope: args.scope,
      productPitch: args.productPitch,
      whatsapp,
      logoStorageId: args.logoStorageId,
      ownerTokenIdentifier: user.tokenIdentifier,
    })
    const row = await ctx.db.get("businesses", id)
    if (!row) {
      throw new Error("Insert did not persist the business")
    }
    return await toDirectoryBusiness(ctx, row)
  },
})

export const updateProfile = mutation({
  args: updateProfileArgs.fields,
  returns: managedBusiness,
  handler: async (ctx, args) => {
    const business = await requireManagedBusiness(ctx, args.slug)
    const whatsapp = parseNicaraguaE164(args.whatsapp)
    const phone = optionalText(args.phone)
    const parsedPhone = phone ? parseNicaraguaE164(phone) : undefined

    let nextLogo = business.logoStorageId
    if (args.clearLogo) {
      if (business.logoStorageId) {
        await ctx.storage.delete(business.logoStorageId)
      }
      nextLogo = undefined
    } else if (args.logoStorageId) {
      if (
        business.logoStorageId &&
        business.logoStorageId !== args.logoStorageId
      ) {
        await ctx.storage.delete(business.logoStorageId)
      }
      nextLogo = args.logoStorageId
    }

    const address = optionalText(args.address)
    const hours = optionalText(args.hours)

    await ctx.db.replace("businesses", business._id, {
      slug: business.slug,
      name: args.name,
      kind: business.kind,
      description: args.description,
      advantages: args.advantages,
      scope: args.scope,
      productPitch: args.productPitch,
      whatsapp,
      ...(parsedPhone ? { phone: parsedPhone } : {}),
      ...(address ? { address } : {}),
      ...(hours ? { hours } : {}),
      ...(nextLogo ? { logoStorageId: nextLogo } : {}),
      ownerTokenIdentifier: business.ownerTokenIdentifier,
    })

    const row = await ctx.db.get("businesses", business._id)
    if (!row) {
      throw new Error("Update did not persist the business")
    }
    return await toManagedBusiness(ctx, row)
  },
})

import { ConvexError, v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import {
  isBusinessManagerKind,
  isBusinessSuspended,
  requireAdmin,
  requireBusinessBySlug,
  requireManagedBusiness,
} from "./access"
import { deleteStorageIfUnreferenced } from "./files"
import { requireSignedInUser } from "./identity"
import { parseNicaraguaE164 } from "./phone"
import { toStoreProduct } from "./products"
import {
  businessKind,
  directoryBusiness,
  managedBusiness,
  storefront,
} from "./schema"

const DIRECTORY_LIST_LIMIT = 100
const SUSPENSION_REASON_MAX = 200
const RESERVED_SLUGS = new Set([
  "login",
  "register",
  "logout",
  "admin",
  "api",
  "rider",
])

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
    suspendedAt: doc.suspendedAt ?? null,
    suspensionReason: doc.suspensionReason ?? null,
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
      .withIndex("by_suspendedAt", (q) => q.eq("suspendedAt", undefined))
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
    if (!row || isBusinessSuspended(row)) {
      return null
    }
    return await toDirectoryBusiness(ctx, row)
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

    if (!business || isBusinessSuspended(business)) {
      return null
    }

    const productRows = await ctx.db
      .query("products")
      .withIndex("by_businessId_and_available", (q) =>
        q.eq("businessId", business._id).eq("available", true)
      )
      .order("desc")
      .take(DIRECTORY_LIST_LIMIT)

    const products = await Promise.all(
      productRows.map((product) => toStoreProduct(ctx, product))
    )

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
    if (!isBusinessManagerKind(user.kind)) {
      throw new ConvexError("FORBIDDEN")
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

export const listAllForAdmin = query({
  args: {},
  returns: v.array(managedBusiness),
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const rows = await ctx.db
      .query("businesses")
      .order("desc")
      .take(DIRECTORY_LIST_LIMIT)
    return await Promise.all(rows.map((row) => toManagedBusiness(ctx, row)))
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
    if (!isBusinessManagerKind(user.kind)) {
      throw new ConvexError("FORBIDDEN")
    }

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
    let previousLogoToDelete: typeof business.logoStorageId
    if (args.clearLogo) {
      previousLogoToDelete = business.logoStorageId
      nextLogo = undefined
    } else if (args.logoStorageId) {
      if (business.logoStorageId !== args.logoStorageId) {
        previousLogoToDelete = business.logoStorageId
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
      // replace() drops fields it does not list, so the admin suspension
      // state must be carried over explicitly.
      ...(business.suspendedAt !== undefined
        ? { suspendedAt: business.suspendedAt }
        : {}),
      ...(business.suspensionReason !== undefined
        ? { suspensionReason: business.suspensionReason }
        : {}),
    })

    const row = await ctx.db.get("businesses", business._id)
    if (!row) {
      throw new Error("Update did not persist the business")
    }
    if (previousLogoToDelete) {
      await deleteStorageIfUnreferenced(ctx, previousLogoToDelete)
    }
    return await toManagedBusiness(ctx, row)
  },
})

export const suspend = mutation({
  args: { slug: v.string(), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const business = await requireBusinessBySlug(ctx, args.slug)
    const reason = args.reason.trim()
    if (reason.length === 0 || reason.length > SUSPENSION_REASON_MAX) {
      throw new ConvexError("INVALID_REASON")
    }

    await ctx.db.patch("businesses", business._id, {
      suspendedAt: Date.now(),
      suspensionReason: reason,
    })
    return null
  },
})

export const reactivate = mutation({
  args: { slug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const business = await requireBusinessBySlug(ctx, args.slug)

    await ctx.db.patch("businesses", business._id, {
      suspendedAt: undefined,
      suspensionReason: undefined,
    })
    return null
  },
})

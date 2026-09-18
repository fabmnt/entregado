import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server"
import { ConvexError, v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { requireManagedBusiness } from "./access"
import { createAuth } from "./auth"
import { isActiveProfile } from "./identity"
import { riderView } from "./schema"

const RIDER_NAME_MAX = 80

function isDuplicateUserError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false
  }
  const record = error as {
    status?: unknown
    message?: unknown
    body?: unknown
  }
  const bodyCode =
    record.body && typeof record.body === "object"
      ? (record.body as { code?: unknown }).code
      : undefined
  if (bodyCode === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
    return true
  }
  if (record.status === 422) {
    return true
  }
  const message =
    `${String(record.message ?? "")} ${JSON.stringify(record.body ?? "")}`.toLowerCase()
  return (
    message.includes("already exists") ||
    message.includes("already registered") ||
    message.includes("unique")
  )
}

function toRiderView(row: Doc<"users">) {
  return {
    id: row._id,
    name: row.name ?? "",
    email: row.email ?? "",
    active: isActiveProfile(row),
  }
}

async function findManagedRider(
  ctx: QueryCtx | MutationCtx,
  slug: string,
  riderId: Id<"users">
): Promise<Doc<"users"> | null> {
  const business = await requireManagedBusiness(ctx, slug)
  const rider = await ctx.db.get("users", riderId)
  if (!rider || rider.kind !== "rider" || rider.businessId !== business._id) {
    return null
  }
  return rider
}

async function requireManagedRider(
  ctx: QueryCtx | MutationCtx,
  slug: string,
  riderId: Id<"users">
): Promise<Doc<"users">> {
  const rider = await findManagedRider(ctx, slug, riderId)
  if (!rider) {
    throw new ConvexError("NOT_FOUND")
  }
  return rider
}

function readName(value: string): string {
  const name = value.trim()
  if (name.length === 0 || name.length > RIDER_NAME_MAX) {
    throw new ConvexError("INVALID_NAME")
  }
  return name
}

export const listManaged = query({
  args: { slug: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(riderView),
  handler: async (ctx, args) => {
    const business = await requireManagedBusiness(ctx, args.slug)
    const result = await ctx.db
      .query("users")
      .withIndex("by_businessId_and_kind", (q) =>
        q.eq("businessId", business._id).eq("kind", "rider")
      )
      .order("desc")
      .paginate(args.paginationOpts)

    return { ...result, page: result.page.map(toRiderView) }
  },
})

export const getManaged = query({
  args: { slug: v.string(), riderId: v.id("users") },
  returns: v.union(riderView, v.null()),
  handler: async (ctx, args) => {
    const rider = await findManagedRider(ctx, args.slug, args.riderId)
    return rider ? toRiderView(rider) : null
  },
})

export const updateName = mutation({
  args: {
    slug: v.string(),
    riderId: v.id("users"),
    name: v.string(),
  },
  returns: riderView,
  handler: async (ctx, args) => {
    const rider = await requireManagedRider(ctx, args.slug, args.riderId)
    const name = readName(args.name)

    await ctx.db.patch("users", rider._id, { name })
    const row = await ctx.db.get("users", rider._id)
    if (!row) {
      throw new Error("Update did not persist the rider")
    }
    return toRiderView(row)
  },
})

export const setActive = mutation({
  args: {
    slug: v.string(),
    riderId: v.id("users"),
    active: v.boolean(),
  },
  returns: riderView,
  handler: async (ctx, args) => {
    const rider = await requireManagedRider(ctx, args.slug, args.riderId)

    if (!args.active) {
      // A deactivated rider is redirected away from the board, so an accepted
      // delivery would sit unfinished forever. Hand it back to the board.
      const assigned = await ctx.db
        .query("sales")
        .withIndex("by_riderUserId_and_status", (q) =>
          q.eq("riderUserId", rider._id).eq("status", "accepted")
        )
        .collect()
      for (const sale of assigned) {
        await ctx.db.patch("sales", sale._id, {
          status: "pending",
          riderUserId: undefined,
          riderName: undefined,
        })
      }
    }

    await ctx.db.patch("users", rider._id, { active: args.active })
    const row = await ctx.db.get("users", rider._id)
    if (!row) {
      throw new Error("Update did not persist the rider")
    }
    return toRiderView(row)
  },
})

export const create = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    email: v.string(),
    password: v.string(),
  },
  returns: riderView,
  handler: async (ctx, args) => {
    const business = await requireManagedBusiness(ctx, args.slug)
    const name = readName(args.name)
    const email = args.email.trim().toLowerCase()
    if (args.password.length < 8) {
      throw new ConvexError("INVALID_PASSWORD")
    }

    let authUserId: string
    try {
      const created = await createAuth(ctx).api.signUpEmail({
        body: {
          name,
          email,
          password: args.password,
          rememberMe: false,
        },
      })
      authUserId = created.user.id
    } catch (error) {
      if (isDuplicateUserError(error)) {
        throw new ConvexError("EMAIL_TAKEN")
      }
      throw error
    }

    const profile = await ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", authUserId))
      .unique()

    if (!profile) {
      throw new Error("Rider profile was not created")
    }

    await ctx.db.patch("users", profile._id, {
      kind: "rider",
      businessId: business._id,
      name,
      email,
      active: true,
    })

    return {
      id: profile._id,
      name,
      email,
      active: true,
    }
  },
})

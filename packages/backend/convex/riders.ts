import { ConvexError, v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { requireManagedBusiness } from "./access"
import { createAuth } from "./auth"
import { riderView } from "./schema"

const RIDER_LIST_LIMIT = 50
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

export const listManaged = query({
  args: { slug: v.string() },
  returns: v.array(riderView),
  handler: async (ctx, args) => {
    const business = await requireManagedBusiness(ctx, args.slug)
    const rows = await ctx.db
      .query("users")
      .withIndex("by_businessId", (q) => q.eq("businessId", business._id))
      .take(RIDER_LIST_LIMIT)

    return rows
      .filter((row) => row.kind === "rider")
      .map((row) => ({
        id: row._id,
        name: row.name ?? "",
        email: row.email ?? "",
      }))
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
    const name = args.name.trim()
    const email = args.email.trim().toLowerCase()
    if (name.length === 0 || name.length > RIDER_NAME_MAX) {
      throw new ConvexError("INVALID_NAME")
    }
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
    })

    return {
      id: profile._id,
      name,
      email,
    }
  },
})

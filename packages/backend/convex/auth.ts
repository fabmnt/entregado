import {
  createClient,
  type AuthFunctions,
  type GenericCtx,
} from "@convex-dev/better-auth"
import { convex } from "@convex-dev/better-auth/plugins"
import { betterAuth } from "better-auth/minimal"
import { components, internal } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import authConfig from "./auth.config"

const siteUrl = process.env.SITE_URL!
const authFunctions: AuthFunctions = internal.auth

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, doc) => {
        const admins = await ctx.db
          .query("users")
          .withIndex("by_kind", (q) => q.eq("kind", "admin"))
          .take(1)

        await ctx.db.insert("users", {
          authUserId: doc._id,
          kind: admins.length === 0 ? "admin" : "business_owner",
        })
      },
      onDelete: async (ctx, doc) => {
        const profile = await ctx.db
          .query("users")
          .withIndex("by_auth_user", (q) => q.eq("authUserId", doc._id))
          .unique()
        if (profile) {
          await ctx.db.delete("users", profile._id)
        }
      },
    },
  },
})

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    appName: "Entregado",
    baseURL: siteUrl,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [convex({ authConfig })],
  })
}

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi()

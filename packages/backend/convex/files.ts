import { v } from "convex/values"
import { mutation } from "./_generated/server"
import { requireSignedInUser } from "./identity"

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireSignedInUser(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

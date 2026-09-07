import { ConvexError } from "convex/values"

export function isConvexErrorCode(error: unknown, code: string): boolean {
  return error instanceof ConvexError && error.data === code
}

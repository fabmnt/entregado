import { ConvexError } from "convex/values"

export function isConvexErrorCode(error: unknown, code: string): boolean {
  return error instanceof ConvexError && error.data === code
}

// Convex reports cursors that do not belong to the query this way, including
// cursors issued by another deployment or another paginated query.
export function isInvalidCursorError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("InvalidCursor")
}

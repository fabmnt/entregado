import { isInvalidCursorError } from "./convex-error"

// A cursor outlives the list it came from: a stale link, or one copied from a
// different paginated route, is rejected by Convex with InvalidCursor. Load the
// first page instead of failing the whole page.
export async function withCursorFallback<T>(
  cursor: string | null,
  load: (cursor: string | null) => Promise<T>
): Promise<T> {
  try {
    return await load(cursor)
  } catch (error) {
    if (cursor === null || !isInvalidCursorError(error)) {
      throw error
    }
    return await load(null)
  }
}

import type { Id } from "@entregado/backend"
import { api, getConvexClient } from "./convex"

const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const UPLOAD_TIMEOUT_MS = 30_000
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export function isFilledFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0
}

export function imageFieldError(file: File): string | null {
  if (!IMAGE_TYPES.has(file.type)) {
    return "Usa JPG, PNG o WebP"
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "La imagen no puede pasar de 2 MB"
  }
  return null
}

export async function uploadImage(
  file: File,
  token: string
): Promise<Id<"_storage">> {
  const uploadUrl = await getConvexClient(token).mutation(
    api.files.generateUploadUrl,
    {}
  )
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS)

  try {
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error("UPLOAD_FAILED")
    }

    const payload: unknown = await response.json()
    if (
      !payload ||
      typeof payload !== "object" ||
      !("storageId" in payload) ||
      typeof payload.storageId !== "string"
    ) {
      throw new Error("UPLOAD_FAILED")
    }

    return payload.storageId as Id<"_storage">
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("UPLOAD_FAILED", { cause: error })
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function deleteUploadedImage(
  storageId: Id<"_storage">,
  token: string
): Promise<boolean> {
  try {
    await getConvexClient(token).mutation(api.files.deleteIfUnreferenced, {
      storageId,
    })
    return true
  } catch {
    return false
  }
}

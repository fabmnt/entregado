import type { ManagedBusiness } from "@entregado/types"
import { z } from "zod"
import { fieldErrorsFromZod } from "./businesses"
import { api, getConvexClient } from "./convex"
import { isConvexErrorCode } from "./convex-error"

const SUSPENSION_REASON_MAX = 200

const suspendBusinessSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Escribe el motivo")
    .max(
      SUSPENSION_REASON_MAX,
      `No puede pasar de ${SUSPENSION_REASON_MAX} caracteres`
    ),
})

export type SuspendFieldErrors = Partial<Record<"reason", string>>

export type SuspendResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors: SuspendFieldErrors }

export type AdminActionResult = { ok: true } | { ok: false; error: string }

export async function listAdminBusinesses(
  token: string
): Promise<ManagedBusiness[]> {
  return await getConvexClient(token).query(api.businesses.listAllForAdmin, {})
}

export async function suspendBusiness(
  slug: string,
  input: unknown,
  token: string | null
): Promise<SuspendResult> {
  const parsed = suspendBusinessSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa el motivo",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    }
  }

  if (!token) {
    return {
      ok: false,
      error: "Inicia sesión para suspender el negocio",
      fieldErrors: {},
    }
  }

  try {
    await getConvexClient(token).mutation(api.businesses.suspend, {
      slug,
      reason: parsed.data.reason,
    })
    return { ok: true }
  } catch (error) {
    if (isConvexErrorCode(error, "UNAUTHENTICATED")) {
      return {
        ok: false,
        error: "Inicia sesión para suspender el negocio",
        fieldErrors: {},
      }
    }
    if (
      isConvexErrorCode(error, "FORBIDDEN") ||
      isConvexErrorCode(error, "NOT_FOUND")
    ) {
      return {
        ok: false,
        error: "No puedes suspender este negocio",
        fieldErrors: {},
      }
    }
    if (isConvexErrorCode(error, "INVALID_REASON")) {
      return {
        ok: false,
        error: "Revisa el motivo",
        fieldErrors: {
          reason: `No puede pasar de ${SUSPENSION_REASON_MAX} caracteres`,
        },
      }
    }
    throw error
  }
}

export async function reactivateBusiness(
  slug: string,
  token: string
): Promise<AdminActionResult> {
  try {
    await getConvexClient(token).mutation(api.businesses.reactivate, { slug })
    return { ok: true }
  } catch (error) {
    if (isConvexErrorCode(error, "UNAUTHENTICATED")) {
      return { ok: false, error: "Inicia sesión para reactivar el negocio" }
    }
    if (
      isConvexErrorCode(error, "FORBIDDEN") ||
      isConvexErrorCode(error, "NOT_FOUND")
    ) {
      return { ok: false, error: "No puedes reactivar este negocio" }
    }
    return { ok: false, error: "No se pudo reactivar el negocio" }
  }
}

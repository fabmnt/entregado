import type { RiderView } from "@entregado/types"
import { z } from "zod"
import { fieldErrorsFromZod } from "./businesses"
import { api, getConvexClient } from "./convex"
import { isConvexErrorCode } from "./convex-error"

export const createRiderSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  email: z
    .email("El correo no es válido")
    .trim()
    .toLowerCase()
    .min(1, "El correo es obligatorio"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
})

export type RiderFieldErrors = Partial<
  Record<"name" | "email" | "password", string>
>

export type CreateRiderResult =
  | { ok: true; rider: RiderView }
  | { ok: false; status: 400; error: string; fieldErrors: RiderFieldErrors }
  | { ok: false; status: 401; error: string; fieldErrors: RiderFieldErrors }
  | { ok: false; status: 403; error: string; fieldErrors: RiderFieldErrors }
  | { ok: false; status: 409; error: string; fieldErrors: RiderFieldErrors }

export async function listManagedRiders(slug: string, token: string) {
  return await getConvexClient(token).query(api.riders.listManaged, { slug })
}

export async function createRider(
  slug: string,
  input: unknown,
  token: string | null
): Promise<CreateRiderResult> {
  const parsed = createRiderSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: "Revisa los datos del repartidor",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    }
  }

  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Inicia sesión para guardar",
      fieldErrors: {},
    }
  }

  try {
    const rider = await getConvexClient(token).mutation(api.riders.create, {
      slug,
      ...parsed.data,
    })
    return { ok: true, rider }
  } catch (error) {
    if (isConvexErrorCode(error, "UNAUTHENTICATED")) {
      return {
        ok: false,
        status: 401,
        error: "Inicia sesión para guardar",
        fieldErrors: {},
      }
    }
    if (
      isConvexErrorCode(error, "FORBIDDEN") ||
      isConvexErrorCode(error, "NOT_FOUND")
    ) {
      return {
        ok: false,
        status: 403,
        error: "No puedes crear repartidores en este negocio",
        fieldErrors: {},
      }
    }
    if (isConvexErrorCode(error, "EMAIL_TAKEN")) {
      return {
        ok: false,
        status: 409,
        error: "Ese correo ya tiene una cuenta",
        fieldErrors: { email: "Ese correo ya está en uso" },
      }
    }
    if (isConvexErrorCode(error, "INVALID_PASSWORD")) {
      return {
        ok: false,
        status: 400,
        error: "Revisa la contraseña",
        fieldErrors: {
          password: "La contraseña debe tener al menos 8 caracteres",
        },
      }
    }
    if (isConvexErrorCode(error, "INVALID_NAME")) {
      return {
        ok: false,
        status: 400,
        error: "Revisa el nombre",
        fieldErrors: { name: "El nombre es obligatorio" },
      }
    }
    throw error
  }
}

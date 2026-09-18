import type { Id } from "@entregado/backend"
import type { RiderView } from "@entregado/types"
import { z } from "zod"
import { fieldErrorsFromZod } from "./businesses"
import { api, getConvexClient } from "./convex"
import { isConvexErrorCode } from "./convex-error"
import { withCursorFallback } from "./pagination"

const RIDER_NAME_MAX = 80

export const riderNameSchema = z
  .string()
  .trim()
  .min(1, "El nombre es obligatorio")
  .max(RIDER_NAME_MAX, `No puede pasar de ${RIDER_NAME_MAX} caracteres`)

export const createRiderSchema = z.object({
  name: riderNameSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "El correo es obligatorio")
    .pipe(z.email("El correo no es válido")),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
})

const updateRiderNameSchema = z.object({
  name: riderNameSchema,
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

export type UpdateRiderResult =
  | { ok: true; rider: RiderView }
  | { ok: false; status: 400; error: string; fieldErrors: RiderFieldErrors }
  | { ok: false; status: 401; error: string; fieldErrors: RiderFieldErrors }
  | { ok: false; status: 403; error: string; fieldErrors: RiderFieldErrors }

export type RiderActionResult = { ok: true } | { ok: false; error: string }

const RIDER_PAGE_SIZE = 20

export async function listManagedRiders(
  slug: string,
  token: string,
  cursor: string | null
) {
  return await withCursorFallback(cursor, (pageCursor) =>
    getConvexClient(token).query(api.riders.listManaged, {
      slug,
      paginationOpts: { numItems: RIDER_PAGE_SIZE, cursor: pageCursor },
    })
  )
}

export async function getManagedRider(
  slug: string,
  riderId: Id<"users">,
  token: string
): Promise<RiderView | null> {
  return await getConvexClient(token).query(api.riders.getManaged, {
    slug,
    riderId,
  })
}

export async function updateRiderName(
  slug: string,
  riderId: Id<"users">,
  input: unknown,
  token: string | null
): Promise<UpdateRiderResult> {
  const parsed = updateRiderNameSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: "Revisa el nombre",
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
    const rider = await getConvexClient(token).mutation(api.riders.updateName, {
      slug,
      riderId,
      name: parsed.data.name,
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
        error: "No puedes editar este repartidor",
        fieldErrors: {},
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

export async function setRiderActive(
  slug: string,
  riderId: Id<"users">,
  active: boolean,
  token: string
): Promise<RiderActionResult> {
  try {
    await getConvexClient(token).mutation(api.riders.setActive, {
      slug,
      riderId,
      active,
    })
    return { ok: true }
  } catch (error) {
    if (isConvexErrorCode(error, "UNAUTHENTICATED")) {
      return { ok: false, error: "Inicia sesión para continuar" }
    }
    if (
      isConvexErrorCode(error, "FORBIDDEN") ||
      isConvexErrorCode(error, "NOT_FOUND")
    ) {
      return { ok: false, error: "No puedes cambiar este repartidor" }
    }
    return { ok: false, error: "No se pudo cambiar el estado del repartidor" }
  }
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

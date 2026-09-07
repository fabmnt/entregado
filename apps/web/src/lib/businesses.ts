import {
  BUSINESS_KINDS,
  type CreateDirectoryBusinessInput,
  type DirectoryBusiness,
} from "@entregado/types"
import { ConvexError } from "convex/values"
import { z } from "zod"
import { api, getConvexClient } from "./convex"

const SLUG_MAX_LENGTH = 48
const DIRECTORY_TEXT_MAX_LENGTH = 500

const createBusinessSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, "El slug debe tener al menos 2 caracteres")
    .max(
      SLUG_MAX_LENGTH,
      `El slug no puede pasar de ${SLUG_MAX_LENGTH} caracteres`
    )
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "El slug solo admite minúsculas, números y guiones"
    ),
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(
      DIRECTORY_TEXT_MAX_LENGTH,
      `El nombre no puede pasar de ${DIRECTORY_TEXT_MAX_LENGTH} caracteres`
    ),
  kind: z.enum(BUSINESS_KINDS, { error: "El tipo de negocio no es válido" }),
  description: z
    .string()
    .trim()
    .min(1, "La descripción es obligatoria")
    .max(
      DIRECTORY_TEXT_MAX_LENGTH,
      `La descripción no puede pasar de ${DIRECTORY_TEXT_MAX_LENGTH} caracteres`
    ),
  advantages: z
    .string()
    .trim()
    .min(1, "Las ventajas son obligatorias")
    .max(
      DIRECTORY_TEXT_MAX_LENGTH,
      `Las ventajas no pueden pasar de ${DIRECTORY_TEXT_MAX_LENGTH} caracteres`
    ),
  scope: z
    .string()
    .trim()
    .min(1, "El alcance es obligatorio")
    .max(
      DIRECTORY_TEXT_MAX_LENGTH,
      `El alcance no puede pasar de ${DIRECTORY_TEXT_MAX_LENGTH} caracteres`
    ),
  productPitch: z
    .string()
    .trim()
    .min(1, "La promoción de productos es obligatoria")
    .max(
      DIRECTORY_TEXT_MAX_LENGTH,
      `La promoción no puede pasar de ${DIRECTORY_TEXT_MAX_LENGTH} caracteres`
    ),
})

export type FieldErrors = Partial<
  Record<keyof CreateDirectoryBusinessInput, string>
>

export type CreateBusinessResult =
  | { ok: true; business: DirectoryBusiness }
  | { ok: false; status: 400; error: string; fieldErrors: FieldErrors }
  | { ok: false; status: 401; error: string; fieldErrors: FieldErrors }
  | { ok: false; status: 409; error: string; fieldErrors: FieldErrors }

function fieldErrorsFromZod(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {}

  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key !== "string" || key in fieldErrors) {
      continue
    }
    fieldErrors[key as keyof FieldErrors] = issue.message
  }

  return fieldErrors
}

function isConvexErrorCode(error: unknown, code: string): boolean {
  return error instanceof ConvexError && error.data === code
}

export async function listBusinesses(): Promise<DirectoryBusiness[]> {
  return await getConvexClient().query(api.businesses.list, {})
}

export async function getBusinessBySlug(
  slug: string
): Promise<DirectoryBusiness | null> {
  return await getConvexClient().query(api.businesses.getBySlug, { slug })
}

export async function listManagedBusinesses(
  token: string
): Promise<DirectoryBusiness[]> {
  return await getConvexClient(token).query(api.businesses.listForSignedIn, {})
}

export async function createBusiness(
  input: unknown,
  token: string | null
): Promise<CreateBusinessResult> {
  const parsed = createBusinessSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: "Revisa los datos del negocio",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    }
  }

  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Inicia sesión para registrar un negocio",
      fieldErrors: {},
    }
  }

  try {
    const business = await getConvexClient(token).mutation(
      api.businesses.create,
      parsed.data
    )
    return { ok: true, business }
  } catch (error) {
    if (isConvexErrorCode(error, "UNAUTHENTICATED")) {
      return {
        ok: false,
        status: 401,
        error: "Inicia sesión para registrar un negocio",
        fieldErrors: {},
      }
    }
    if (isConvexErrorCode(error, "SLUG_TAKEN")) {
      return {
        ok: false,
        status: 409,
        error: "Ya existe un negocio con ese slug",
        fieldErrors: { slug: "Ese slug ya está en uso" },
      }
    }
    throw error
  }
}

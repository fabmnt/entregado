import type { Id } from "@entregado/backend"
import {
  BUSINESS_KINDS,
  RESERVED_BUSINESS_SLUGS,
  type CreateDirectoryBusinessInput,
  type DirectoryBusiness,
  type ManagedBusiness,
  type Storefront,
} from "@entregado/types"
import { parseNicaraguaPhone } from "@entregado/utils"
import { z } from "zod"
import { api, getConvexClient } from "./convex"
import { isConvexErrorCode } from "./convex-error"

const SLUG_MAX_LENGTH = 48
const DIRECTORY_TEXT_MAX_LENGTH = 500
const reservedSlugs: string[] = [...RESERVED_BUSINESS_SLUGS]

const nicaraguaPhone = z
  .string()
  .trim()
  .min(1, "WhatsApp es obligatorio")
  .refine(
    (value) => parseNicaraguaPhone(value) !== null,
    "Escribe 8 dígitos de Nicaragua"
  )

const optionalNicaraguaPhone = z
  .string()
  .trim()
  .refine(
    (value) => value.length === 0 || parseNicaraguaPhone(value) !== null,
    "Escribe 8 dígitos de Nicaragua"
  )

const textField = (emptyMessage: string) =>
  z
    .string()
    .trim()
    .min(1, emptyMessage)
    .max(
      DIRECTORY_TEXT_MAX_LENGTH,
      `No puede pasar de ${DIRECTORY_TEXT_MAX_LENGTH} caracteres`
    )

const optionalTextField = z
  .string()
  .trim()
  .max(
    DIRECTORY_TEXT_MAX_LENGTH,
    `No puede pasar de ${DIRECTORY_TEXT_MAX_LENGTH} caracteres`
  )

export const createBusinessSchema = z.object({
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
    )
    .refine((slug) => !reservedSlugs.includes(slug), "Ese slug está reservado"),
  name: textField("El nombre es obligatorio"),
  kind: z.enum(BUSINESS_KINDS, { error: "El tipo de negocio no es válido" }),
  description: textField("La descripción es obligatoria"),
  advantages: textField("Las ventajas son obligatorias"),
  scope: textField("El alcance es obligatorio"),
  productPitch: textField("La promoción de productos es obligatoria"),
  whatsapp: nicaraguaPhone,
})

export const updateProfileSchema = z.object({
  name: textField("El nombre es obligatorio"),
  description: textField("La descripción es obligatoria"),
  advantages: textField("Las ventajas son obligatorias"),
  scope: textField("El alcance es obligatorio"),
  productPitch: textField("La promoción de productos es obligatoria"),
  whatsapp: nicaraguaPhone,
  phone: optionalNicaraguaPhone,
  address: optionalTextField,
  hours: optionalTextField,
})

export type CreateFieldErrors = Partial<
  Record<keyof CreateDirectoryBusinessInput, string>
> & {
  logo?: string
}
export type ProfileFieldErrors = Partial<
  Record<keyof z.infer<typeof updateProfileSchema>, string>
> & {
  logo?: string
}

export function fieldErrorsFromZod<T extends string>(
  error: z.ZodError
): Partial<Record<T, string>> {
  const fieldErrors: Partial<Record<T, string>> = {}

  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key !== "string" || key in fieldErrors) {
      continue
    }
    fieldErrors[key as T] = issue.message
  }

  return fieldErrors
}

export type CreateBusinessResult =
  | { ok: true; business: DirectoryBusiness }
  | { ok: false; status: 400; error: string; fieldErrors: CreateFieldErrors }
  | { ok: false; status: 401; error: string; fieldErrors: CreateFieldErrors }
  | { ok: false; status: 409; error: string; fieldErrors: CreateFieldErrors }

export type UpdateProfileResult =
  | { ok: true; business: ManagedBusiness }
  | { ok: false; status: 400; error: string; fieldErrors: ProfileFieldErrors }
  | { ok: false; status: 401; error: string; fieldErrors: ProfileFieldErrors }
  | { ok: false; status: 403; error: string; fieldErrors: ProfileFieldErrors }

export async function listManagedBusinesses(
  token: string
): Promise<DirectoryBusiness[]> {
  return await getConvexClient(token).query(api.businesses.listForSignedIn, {})
}

export async function getManagedBusiness(
  slug: string,
  token: string
): Promise<ManagedBusiness | null> {
  return await getConvexClient(token).query(api.businesses.getManagedBySlug, {
    slug,
  })
}

export async function getStorefront(slug: string): Promise<Storefront | null> {
  return await getConvexClient().query(api.businesses.getStoreBySlug, { slug })
}

export async function createBusiness(
  input: unknown,
  token: string | null,
  logoStorageId?: Id<"_storage">
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
      {
        ...parsed.data,
        ...(logoStorageId ? { logoStorageId } : {}),
      }
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
    if (isConvexErrorCode(error, "SLUG_RESERVED")) {
      return {
        ok: false,
        status: 409,
        error: "Ese slug está reservado",
        fieldErrors: { slug: "Ese slug está reservado" },
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
    if (isConvexErrorCode(error, "INVALID_PHONE")) {
      return {
        ok: false,
        status: 400,
        error: "Revisa el WhatsApp",
        fieldErrors: { whatsapp: "Escribe 8 dígitos de Nicaragua" },
      }
    }
    throw error
  }
}

export async function updateBusinessProfile(
  slug: string,
  input: unknown,
  token: string | null,
  options: {
    logoStorageId?: Id<"_storage">
    clearLogo: boolean
  }
): Promise<UpdateProfileResult> {
  const parsed = updateProfileSchema.safeParse(input)

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
      error: "Inicia sesión para guardar",
      fieldErrors: {},
    }
  }

  try {
    const business = await getConvexClient(token).mutation(
      api.businesses.updateProfile,
      {
        slug,
        ...parsed.data,
        clearLogo: options.clearLogo,
        ...(options.logoStorageId
          ? { logoStorageId: options.logoStorageId }
          : {}),
      }
    )
    return { ok: true, business }
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
        error: "No puedes editar este negocio",
        fieldErrors: {},
      }
    }
    if (isConvexErrorCode(error, "INVALID_PHONE")) {
      return {
        ok: false,
        status: 400,
        error: "Revisa el teléfono",
        fieldErrors: { whatsapp: "Escribe 8 dígitos de Nicaragua" },
      }
    }
    throw error
  }
}

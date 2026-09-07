import type { Id } from "@entregado/backend"
import type { StoreProduct } from "@entregado/types"
import { z } from "zod"
import { api, getConvexClient } from "./convex"
import { isConvexErrorCode } from "./convex-error"
import { fieldErrorsFromZod } from "./businesses"

export const productFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  description: z
    .string()
    .trim()
    .min(1, "La descripción es obligatoria")
    .max(500),
  price: z
    .string()
    .trim()
    .min(1, "El precio es obligatorio")
    .refine((value) => {
      const parsed = Number(value.replace(",", "."))
      return Number.isFinite(parsed) && parsed >= 0
    }, "El precio debe ser 0 o más"),
  available: z.boolean(),
})

export type ProductFieldErrors = Partial<
  Record<"name" | "description" | "price" | "photo", string>
>

export type ProductMutationResult =
  | { ok: true; product: StoreProduct }
  | { ok: false; status: 400; error: string; fieldErrors: ProductFieldErrors }
  | { ok: false; status: 401; error: string; fieldErrors: ProductFieldErrors }
  | { ok: false; status: 403; error: string; fieldErrors: ProductFieldErrors }

function parsePrice(raw: string): number {
  return Number(raw.replace(",", "."))
}

function mapProductError(error: unknown): ProductMutationResult | null {
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
      error: "No puedes editar este producto",
      fieldErrors: {},
    }
  }
  if (isConvexErrorCode(error, "INVALID_PRICE")) {
    return {
      ok: false,
      status: 400,
      error: "Revisa el precio",
      fieldErrors: { price: "El precio debe ser 0 o más" },
    }
  }
  return null
}

export async function listManagedProducts(
  slug: string,
  token: string
): Promise<StoreProduct[]> {
  return await getConvexClient(token).query(api.products.listManaged, { slug })
}

export async function getManagedProduct(
  slug: string,
  productId: Id<"products">,
  token: string
): Promise<StoreProduct | null> {
  return await getConvexClient(token).query(api.products.getManaged, {
    slug,
    productId,
  })
}

export async function createProduct(
  slug: string,
  input: unknown,
  token: string | null,
  photoStorageId?: Id<"_storage">
): Promise<ProductMutationResult> {
  const parsed = productFormSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: "Revisa los datos del producto",
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
    const product = await getConvexClient(token).mutation(api.products.create, {
      slug,
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsePrice(parsed.data.price),
      available: parsed.data.available,
      ...(photoStorageId ? { photoStorageId } : {}),
    })
    return { ok: true, product }
  } catch (error) {
    const mapped = mapProductError(error)
    if (mapped) {
      return mapped
    }
    throw error
  }
}

export async function updateProduct(
  slug: string,
  productId: Id<"products">,
  input: unknown,
  token: string | null,
  options: { photoStorageId?: Id<"_storage">; clearPhoto: boolean }
): Promise<ProductMutationResult> {
  const parsed = productFormSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: "Revisa los datos del producto",
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
    const product = await getConvexClient(token).mutation(api.products.update, {
      slug,
      productId,
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsePrice(parsed.data.price),
      available: parsed.data.available,
      clearPhoto: options.clearPhoto,
      ...(options.photoStorageId
        ? { photoStorageId: options.photoStorageId }
        : {}),
    })
    return { ok: true, product }
  } catch (error) {
    const mapped = mapProductError(error)
    if (mapped) {
      return mapped
    }
    throw error
  }
}

export async function deleteProduct(
  slug: string,
  productId: Id<"products">,
  token: string
): Promise<void> {
  await getConvexClient(token).mutation(api.products.remove, {
    slug,
    productId,
  })
}

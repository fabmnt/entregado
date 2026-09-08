import type { Id } from "@entregado/backend"
import {
  FULFILLMENT_MODES,
  MAX_SALE_QUANTITY,
  type FulfillmentMode,
  type SaleStatus,
  type SaleView,
} from "@entregado/types"
import { parseNicaraguaPhone } from "@entregado/utils"
import { z } from "zod"
import { fieldErrorsFromZod } from "./businesses"
import { api, getConvexClient } from "./convex"
import { isConvexErrorCode } from "./convex-error"

const BUYER_NAME_MAX = 80
const BUYER_LOCATION_MAX = 500

export const checkoutSchema = z
  .object({
    quantity: z.coerce
      .number({ error: "La cantidad no es válida" })
      .int("La cantidad debe ser un número entero")
      .min(1, "La cantidad mínima es 1")
      .max(
        MAX_SALE_QUANTITY,
        `La cantidad no puede pasar de ${MAX_SALE_QUANTITY}`
      ),
    buyerName: z
      .string()
      .trim()
      .min(1, "El nombre es obligatorio")
      .max(BUYER_NAME_MAX, `No puede pasar de ${BUYER_NAME_MAX} caracteres`),
    buyerPhone: z
      .string()
      .trim()
      .min(1, "El teléfono es obligatorio")
      .refine(
        (value) => parseNicaraguaPhone(value) !== null,
        "Escribe 8 dígitos de Nicaragua"
      ),
    fulfillment: z.enum(FULFILLMENT_MODES, {
      error: "Elige delivery o retiro",
    }),
    buyerLocation: z
      .string()
      .trim()
      .max(
        BUYER_LOCATION_MAX,
        `No puede pasar de ${BUYER_LOCATION_MAX} caracteres`
      ),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillment === "delivery" && data.buyerLocation.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["buyerLocation"],
        message: "La ubicación es obligatoria para delivery",
      })
    }
  })

export type CheckoutFieldErrors = Partial<
  Record<
    "quantity" | "buyerName" | "buyerPhone" | "fulfillment" | "buyerLocation",
    string
  >
>

export type CheckoutResult =
  | { ok: true; sale: SaleView }
  | { ok: false; status: 400; error: string; fieldErrors: CheckoutFieldErrors }
  | { ok: false; status: 404; error: string; fieldErrors: CheckoutFieldErrors }

export type SaleActionResult = { ok: true } | { ok: false; error: string }

export function saleStatusLabel(status: SaleStatus): string {
  if (status === "pending") {
    return "Pendiente"
  }
  if (status === "accepted") {
    return "En entrega"
  }
  if (status === "completed") {
    return "Completada"
  }
  return "Cancelada"
}

export function fulfillmentLabel(fulfillment: FulfillmentMode): string {
  return fulfillment === "delivery" ? "Delivery" : "Retiro"
}

export async function getStoreProduct(slug: string, productId: Id<"products">) {
  return await getConvexClient().query(api.products.getAvailableForStore, {
    slug,
    productId,
  })
}

export async function getPublicSale(slug: string, saleId: Id<"sales">) {
  return await getConvexClient().query(api.sales.getPublic, { slug, saleId })
}

export async function createSale(
  slug: string,
  productId: Id<"products">,
  input: unknown
): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: "Revisa los datos del pedido",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    }
  }

  const wantsDelivery = parsed.data.fulfillment === "delivery"

  try {
    const sale = await getConvexClient().mutation(api.sales.create, {
      slug,
      productId,
      quantity: parsed.data.quantity,
      buyerName: parsed.data.buyerName,
      buyerPhone: parsed.data.buyerPhone,
      fulfillment: parsed.data.fulfillment,
      ...(wantsDelivery ? { buyerLocation: parsed.data.buyerLocation } : {}),
    })
    return { ok: true, sale }
  } catch (error) {
    if (isConvexErrorCode(error, "NOT_FOUND")) {
      return {
        ok: false,
        status: 404,
        error: "Este producto ya no está disponible",
        fieldErrors: {},
      }
    }
    if (isConvexErrorCode(error, "INVALID_QUANTITY")) {
      return {
        ok: false,
        status: 400,
        error: "Revisa la cantidad",
        fieldErrors: {
          quantity: `La cantidad debe ser entre 1 y ${MAX_SALE_QUANTITY}`,
        },
      }
    }
    if (isConvexErrorCode(error, "INVALID_PHONE")) {
      return {
        ok: false,
        status: 400,
        error: "Revisa el teléfono",
        fieldErrors: { buyerPhone: "Escribe 8 dígitos de Nicaragua" },
      }
    }
    if (isConvexErrorCode(error, "DELIVERY_NOT_AVAILABLE")) {
      return {
        ok: false,
        status: 400,
        error: "Este producto no tiene delivery",
        fieldErrors: {
          fulfillment: "Este producto solo se retira en el negocio",
        },
      }
    }
    if (isConvexErrorCode(error, "INVALID_LOCATION")) {
      return {
        ok: false,
        status: 400,
        error: "Revisa la ubicación",
        fieldErrors: {
          buyerLocation: "La ubicación es obligatoria para delivery",
        },
      }
    }
    if (isConvexErrorCode(error, "INVALID_BUYER_NAME")) {
      return {
        ok: false,
        status: 400,
        error: "Revisa el nombre",
        fieldErrors: { buyerName: "El nombre es obligatorio" },
      }
    }
    throw error
  }
}

export async function listManagedSales(slug: string, token: string) {
  return await getConvexClient(token).query(api.sales.listManaged, { slug })
}

export async function completeSaleAsOwner(
  slug: string,
  saleId: Id<"sales">,
  token: string
): Promise<SaleActionResult> {
  try {
    await getConvexClient(token).mutation(api.sales.completeAsOwner, {
      slug,
      saleId,
    })
    return { ok: true }
  } catch (error) {
    return mapOwnerSaleError(error, "completar")
  }
}

export async function cancelSaleAsOwner(
  slug: string,
  saleId: Id<"sales">,
  token: string
): Promise<SaleActionResult> {
  try {
    await getConvexClient(token).mutation(api.sales.cancelAsOwner, {
      slug,
      saleId,
    })
    return { ok: true }
  } catch (error) {
    return mapOwnerSaleError(error, "cancelar")
  }
}

export async function listRiderSales(token: string) {
  return await getConvexClient(token).query(api.sales.listForRider, {})
}

export async function acceptSale(
  saleId: Id<"sales">,
  token: string
): Promise<SaleActionResult> {
  try {
    await getConvexClient(token).mutation(api.sales.accept, { saleId })
    return { ok: true }
  } catch (error) {
    if (isConvexErrorCode(error, "HAS_ACTIVE_SALE")) {
      return { ok: false, error: "Termina la entrega actual para tomar otra" }
    }
    if (isConvexErrorCode(error, "SALE_NOT_AVAILABLE")) {
      return { ok: false, error: "Ese pedido ya no está disponible" }
    }
    if (
      isConvexErrorCode(error, "FORBIDDEN") ||
      isConvexErrorCode(error, "NOT_FOUND")
    ) {
      return { ok: false, error: "No puedes aceptar este pedido" }
    }
    return { ok: false, error: "No se pudo aceptar el pedido" }
  }
}

export async function completeSaleAsRider(
  saleId: Id<"sales">,
  token: string
): Promise<SaleActionResult> {
  try {
    await getConvexClient(token).mutation(api.sales.completeAsRider, { saleId })
    return { ok: true }
  } catch (error) {
    if (isConvexErrorCode(error, "SALE_NOT_AVAILABLE")) {
      return { ok: false, error: "Ese pedido ya no está en entrega" }
    }
    if (
      isConvexErrorCode(error, "FORBIDDEN") ||
      isConvexErrorCode(error, "NOT_FOUND")
    ) {
      return { ok: false, error: "No puedes completar este pedido" }
    }
    return { ok: false, error: "No se pudo marcar como entregado" }
  }
}

function mapOwnerSaleError(error: unknown, action: string): SaleActionResult {
  if (isConvexErrorCode(error, "SALE_NOT_OPEN")) {
    return { ok: false, error: "Esa venta ya está cerrada" }
  }
  if (isConvexErrorCode(error, "UNAUTHENTICATED")) {
    return { ok: false, error: "Inicia sesión para continuar" }
  }
  if (
    isConvexErrorCode(error, "FORBIDDEN") ||
    isConvexErrorCode(error, "NOT_FOUND")
  ) {
    return { ok: false, error: `No puedes ${action} esta venta` }
  }
  return { ok: false, error: `No se pudo ${action} la venta` }
}

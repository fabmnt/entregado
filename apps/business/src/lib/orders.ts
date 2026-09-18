import type { Id } from "@entregado/backend"
import {
  FULFILLMENT_MODES,
  MAX_ITEM_QUANTITY,
  PAYMENT_METHODS,
  type FulfillmentMode,
  type OrderStatus,
  type OrderView,
  type PaymentMethod,
  type PaymentStatus,
} from "@entregado/types"
import { parseNicaraguaPhone } from "@entregado/utils"
import { z } from "zod"
import { fieldErrorsFromZod } from "./businesses"
import type { CartItem } from "./cart"
import { api, getConvexClient } from "./convex"
import { isConvexErrorCode } from "./convex-error"
import { withCursorFallback } from "./pagination"

const BUYER_NAME_MAX = 80
const BUYER_LOCATION_MAX = 500
const OPEN_ORDER_PAGE_SIZE = 20

export const checkoutSchema = z
  .object({
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
    paymentMethod: z.enum(PAYMENT_METHODS, {
      error: "Elige cómo vas a pagar",
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
    | "quantity"
    | "buyerName"
    | "buyerPhone"
    | "fulfillment"
    | "paymentMethod"
    | "buyerLocation",
    string
  >
>

export type CheckoutResult =
  | { ok: true; order: OrderView }
  | { ok: false; status: 400; error: string; fieldErrors: CheckoutFieldErrors }
  | { ok: false; status: 404; error: string; fieldErrors: CheckoutFieldErrors }

export type OrderActionResult = { ok: true } | { ok: false; error: string }

export function orderStatusLabel(status: OrderStatus): string {
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

export function paymentMethodLabel(method: PaymentMethod | null): string {
  if (method === "cash_on_delivery") {
    return "Efectivo al entregar"
  }
  if (method === "transfer") {
    return "Transferencia"
  }
  return "Sin definir"
}

export function paymentStatusLabel(status: PaymentStatus): string {
  return status === "paid" ? "Pagado" : "Sin pagar"
}

export function orderItemLines(order: OrderView): string[] {
  return order.items.map((item) => `${item.quantity} × ${item.productName}`)
}

export function orderUnitCountLabel(unitCount: number): string {
  return unitCount === 1 ? "1 artículo" : `${unitCount} artículos`
}

export async function getPublicOrder(slug: string, orderId: Id<"orders">) {
  try {
    return await getConvexClient().query(api.orders.getPublic, {
      slug,
      orderId,
    })
  } catch {
    // Malformed ids fail Convex validation before reaching the query.
    // Return null so receipt pages follow the existing /404 path.
    return null
  }
}

export async function createOrder(
  slug: string,
  items: CartItem[],
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

  if (items.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Tu pedido está vacío",
      fieldErrors: {},
    }
  }

  const wantsDelivery = parsed.data.fulfillment === "delivery"

  try {
    const order = await getConvexClient().mutation(api.orders.create, {
      slug,
      items: items.map((item) => ({
        productId: item.productId as Id<"products">,
        quantity: item.quantity,
      })),
      buyerName: parsed.data.buyerName,
      buyerPhone: parsed.data.buyerPhone,
      fulfillment: parsed.data.fulfillment,
      paymentMethod: parsed.data.paymentMethod,
      ...(wantsDelivery ? { buyerLocation: parsed.data.buyerLocation } : {}),
    })
    return { ok: true, order }
  } catch (error) {
    if (isConvexErrorCode(error, "NOT_FOUND")) {
      return {
        ok: false,
        status: 404,
        error: "Uno de los productos ya no está disponible",
        fieldErrors: {},
      }
    }
    if (isConvexErrorCode(error, "INVALID_ITEMS")) {
      return {
        ok: false,
        status: 400,
        error: "Tu pedido está vacío o tiene demasiados productos",
        fieldErrors: {},
      }
    }
    if (isConvexErrorCode(error, "INVALID_QUANTITY")) {
      return {
        ok: false,
        status: 400,
        error: "Revisa las cantidades",
        fieldErrors: {
          quantity: `La cantidad debe ser entre 1 y ${MAX_ITEM_QUANTITY}`,
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
        error: "Hay productos solo para retiro",
        fieldErrors: {
          fulfillment: "Algún producto solo se retira en el negocio",
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

export async function listManagedOrders(
  slug: string,
  token: string,
  cursor: string | null
) {
  return await withCursorFallback(cursor, (pageCursor) =>
    getConvexClient(token).query(api.orders.listManaged, {
      slug,
      paginationOpts: { numItems: OPEN_ORDER_PAGE_SIZE, cursor: pageCursor },
    })
  )
}

export async function completeOrderAsOwner(
  slug: string,
  orderId: Id<"orders">,
  token: string
): Promise<OrderActionResult> {
  try {
    await getConvexClient(token).mutation(api.orders.completeAsOwner, {
      slug,
      orderId,
    })
    return { ok: true }
  } catch (error) {
    return mapOwnerOrderError(error, "completar")
  }
}

export async function cancelOrderAsOwner(
  slug: string,
  orderId: Id<"orders">,
  token: string
): Promise<OrderActionResult> {
  try {
    await getConvexClient(token).mutation(api.orders.cancelAsOwner, {
      slug,
      orderId,
    })
    return { ok: true }
  } catch (error) {
    return mapOwnerOrderError(error, "cancelar")
  }
}

export async function setOrderPaidAsOwner(
  slug: string,
  orderId: Id<"orders">,
  paid: boolean,
  token: string
): Promise<OrderActionResult> {
  try {
    await getConvexClient(token).mutation(api.orders.setPaidAsOwner, {
      slug,
      orderId,
      paid,
    })
    return { ok: true }
  } catch (error) {
    return mapOwnerOrderError(
      error,
      paid ? "marcar como pagado" : "marcar como pendiente"
    )
  }
}

export async function listRiderOrders(token: string) {
  return await getConvexClient(token).query(api.orders.listForRider, {})
}

export async function acceptOrder(
  orderId: Id<"orders">,
  token: string
): Promise<OrderActionResult> {
  try {
    await getConvexClient(token).mutation(api.orders.accept, { orderId })
    return { ok: true }
  } catch (error) {
    if (isConvexErrorCode(error, "RIDER_INACTIVE")) {
      return { ok: false, error: "Tu cuenta está desactivada" }
    }
    if (isConvexErrorCode(error, "HAS_ACTIVE_ORDER")) {
      return { ok: false, error: "Termina la entrega actual para tomar otra" }
    }
    if (isConvexErrorCode(error, "ORDER_NOT_AVAILABLE")) {
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

export async function completeOrderAsRider(
  orderId: Id<"orders">,
  token: string
): Promise<OrderActionResult> {
  try {
    await getConvexClient(token).mutation(api.orders.completeAsRider, {
      orderId,
    })
    return { ok: true }
  } catch (error) {
    if (isConvexErrorCode(error, "RIDER_INACTIVE")) {
      return { ok: false, error: "Tu cuenta está desactivada" }
    }
    if (isConvexErrorCode(error, "ORDER_NOT_AVAILABLE")) {
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

function mapOwnerOrderError(error: unknown, action: string): OrderActionResult {
  if (isConvexErrorCode(error, "ORDER_NOT_OPEN")) {
    return { ok: false, error: "Ese pedido ya está cerrado" }
  }
  if (isConvexErrorCode(error, "ORDER_NOT_AVAILABLE")) {
    return { ok: false, error: "Solo los retiros se completan aquí" }
  }
  if (isConvexErrorCode(error, "UNAUTHENTICATED")) {
    return { ok: false, error: "Inicia sesión para continuar" }
  }
  if (
    isConvexErrorCode(error, "FORBIDDEN") ||
    isConvexErrorCode(error, "NOT_FOUND")
  ) {
    return { ok: false, error: `No puedes ${action} este pedido` }
  }
  return { ok: false, error: `No se pudo ${action} el pedido` }
}

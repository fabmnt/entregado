import type { OrderView } from "@entregado/types"
import { formatCordoba, whatsappMeUrl } from "@entregado/utils"
import { orderItemLines, orderStatusLabel } from "./orders"

export type RiderNoticeStage = "on_the_way" | "arriving"

function orderDetails(order: OrderView): string {
  return `${orderItemLines(order).join(", ")} (${formatCordoba(order.totalPrice)})`
}

export function businessInquiryUrl(
  businessName: string,
  whatsapp: string
): string {
  return whatsappMeUrl(
    whatsapp,
    `Hola, quiero consultar sobre los productos de ${businessName}.`
  )
}

export function orderInquiryUrl(whatsapp: string, order: OrderView): string {
  return whatsappMeUrl(
    whatsapp,
    `Hola, quiero consultar por mi pedido ${order.id} (${orderStatusLabel(order.status)}).`
  )
}

function buyerNoticeMessage(order: OrderView): string {
  const details = orderDetails(order)
  if (order.status === "pending") {
    return order.fulfillment === "pickup"
      ? `Hola ${order.buyerName}, recibimos tu pedido de ${details}. Te avisamos cuando esté listo para retirar.`
      : `Hola ${order.buyerName}, recibimos tu pedido de ${details}. Te avisamos cuando salga a entrega.`
  }
  return order.fulfillment === "pickup"
    ? `Hola ${order.buyerName}, tu pedido de ${details} está listo para retirar.`
    : `Hola ${order.buyerName}, tu pedido de ${details} va en camino.`
}

export function buyerNoticeUrl(order: OrderView): string {
  return whatsappMeUrl(order.buyerPhone, buyerNoticeMessage(order))
}

export function riderNoticeUrl(
  order: OrderView,
  stage: RiderNoticeStage
): string {
  const details = orderDetails(order)
  const message =
    stage === "on_the_way"
      ? `Hola ${order.buyerName}, voy en camino con tu pedido de ${details}.`
      : `Hola ${order.buyerName}, ya estoy llegando con tu pedido de ${details}.`
  return whatsappMeUrl(order.buyerPhone, message)
}

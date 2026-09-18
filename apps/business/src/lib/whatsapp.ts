import type { SaleView } from "@entregado/types"
import { formatCordoba, whatsappMeUrl } from "@entregado/utils"
import { saleStatusLabel } from "./sales"

export type RiderNoticeStage = "on_the_way" | "arriving"

function saleDetails(sale: SaleView): string {
  return `${sale.quantity} × ${sale.productName} (${formatCordoba(sale.totalPrice)})`
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

export function orderInquiryUrl(whatsapp: string, sale: SaleView): string {
  return whatsappMeUrl(
    whatsapp,
    `Hola, quiero consultar por mi pedido ${sale.id} (${saleStatusLabel(sale.status)}).`
  )
}

function buyerNoticeMessage(sale: SaleView): string {
  const details = saleDetails(sale)
  if (sale.status === "pending") {
    return sale.fulfillment === "pickup"
      ? `Hola ${sale.buyerName}, recibimos tu pedido de ${details}. Te avisamos cuando esté listo para retirar.`
      : `Hola ${sale.buyerName}, recibimos tu pedido de ${details}. Te avisamos cuando salga a entrega.`
  }
  return sale.fulfillment === "pickup"
    ? `Hola ${sale.buyerName}, tu pedido de ${details} está listo para retirar.`
    : `Hola ${sale.buyerName}, tu pedido de ${details} va en camino.`
}

export function buyerNoticeUrl(sale: SaleView): string {
  return whatsappMeUrl(sale.buyerPhone, buyerNoticeMessage(sale))
}

export function riderNoticeUrl(
  sale: SaleView,
  stage: RiderNoticeStage
): string {
  const details = saleDetails(sale)
  const message =
    stage === "on_the_way"
      ? `Hola ${sale.buyerName}, voy en camino con tu pedido de ${details}.`
      : `Hola ${sale.buyerName}, ya estoy llegando con tu pedido de ${details}.`
  return whatsappMeUrl(sale.buyerPhone, message)
}

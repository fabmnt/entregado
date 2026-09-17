import type { FulfillmentMode, SaleStatus } from "@entregado/types"
import type { getPublicSale } from "./sales"

const NICARAGUA_TIME_ZONE = "America/Managua"

const dateTimeFormatter = new Intl.DateTimeFormat("es-NI", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: NICARAGUA_TIME_ZONE,
})

export type PublicSale = NonNullable<Awaited<ReturnType<typeof getPublicSale>>>

export type TrackingStepKey = "received" | "inProgress" | "finish"
export type TrackingStepState = "done" | "current" | "pending"

export type TrackingStep = {
  key: TrackingStepKey
  label: string
  state: TrackingStepState
  time: string | null
}

export type OrderTracking = {
  status: SaleStatus
  headline: string
  terminal: boolean
  riderName: string | null
  cancelledAt: string | null
  steps: TrackingStep[]
}

function formatTime(value: string | number | null): string | null {
  if (value === null) {
    return null
  }
  return dateTimeFormatter.format(new Date(value))
}

function inProgressLabel(fulfillment: FulfillmentMode): string {
  return fulfillment === "delivery" ? "En reparto" : "Aceptado"
}

function finishLabel(fulfillment: FulfillmentMode): string {
  return fulfillment === "delivery" ? "Entregado" : "Listo para retirar"
}

function headlineLabel(
  status: SaleStatus,
  fulfillment: FulfillmentMode
): string {
  if (status === "pending") {
    return "Pedido recibido"
  }
  if (status === "cancelled") {
    return "Pedido cancelado"
  }
  if (status === "completed") {
    return finishLabel(fulfillment)
  }
  return fulfillment === "delivery"
    ? "Tu pedido va en camino"
    : "Pedido aceptado"
}

function stepState(done: boolean, current: boolean): TrackingStepState {
  if (done) {
    return "done"
  }
  return current ? "current" : "pending"
}

export function buildOrderTracking(sale: PublicSale): OrderTracking {
  const { fulfillment, status } = sale
  const terminal = status === "completed" || status === "cancelled"

  const advanced = status === "accepted" || status === "completed"
  // A delivery cancelled after a rider took it still passed the middle step.
  const inProgressDone =
    advanced || (status === "cancelled" && sale.riderName !== null)

  return {
    status,
    headline: headlineLabel(status, fulfillment),
    terminal,
    riderName: sale.riderName,
    cancelledAt: formatTime(sale.cancelledAt),
    steps: [
      {
        key: "received",
        label: "Recibido",
        state: "done",
        time: formatTime(sale.createdAt),
      },
      {
        key: "inProgress",
        label: inProgressLabel(fulfillment),
        state: stepState(inProgressDone, status === "pending"),
        // The accepted timestamp is not persisted, so this step has no time.
        time: null,
      },
      {
        key: "finish",
        label: finishLabel(fulfillment),
        state: stepState(status === "completed", status === "accepted"),
        time: formatTime(sale.completedAt),
      },
    ],
  }
}

export const BUSINESS_KINDS = ["food", "pharmacy"] as const
export type BusinessKind = (typeof BUSINESS_KINDS)[number]

export type DirectoryBusiness = {
  id: string
  slug: string
  name: string
  kind: BusinessKind
  description: string
  advantages: string
  scope: string
  productPitch: string
  createdAt: string
}

export type CreateDirectoryBusinessInput = Omit<
  DirectoryBusiness,
  "id" | "createdAt"
>

export const ORDER_STATUSES = [
  "received",
  "accepted",
  "out_for_delivery",
  "ready_for_pickup",
  "delivered",
  "picked_up",
  "rejected",
  "cancelled",
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const FULFILLMENT_MODES = ["delivery", "pickup"] as const
export type FulfillmentMode = (typeof FULFILLMENT_MODES)[number]

export const PAYMENT_METHODS = ["cash_on_delivery", "transfer"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const COUNTRY_ISO = "NI"
export const PHONE_COUNTRY_CODE = "505"
export const CURRENCY_CODE = "NIO"
export const CURRENCY_SYMBOL = "C$"

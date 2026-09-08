export const BUSINESS_KINDS = ["food", "pharmacy"] as const
export type BusinessKind = (typeof BUSINESS_KINDS)[number]

export const USER_KINDS = ["admin", "business_owner"] as const
export type UserKind = (typeof USER_KINDS)[number]

export type SignedInUser = {
  tokenIdentifier: string
  email: string
  name: string
  kind: UserKind
}

export const RESERVED_BUSINESS_SLUGS = [
  "login",
  "register",
  "logout",
  "admin",
  "api",
] as const

export type DirectoryBusiness = {
  id: string
  slug: string
  name: string
  kind: BusinessKind
  description: string
  advantages: string
  scope: string
  productPitch: string
  logoUrl: string | null
  createdAt: string
}

export type ManagedBusiness = DirectoryBusiness & {
  whatsapp?: string
  phone?: string
  address?: string
  hours?: string
}

export type StoreProduct = {
  id: string
  name: string
  description: string
  price: number
  available: boolean
  photoUrl: string | null
}

export type Storefront = {
  business: ManagedBusiness
  products: StoreProduct[]
}

export type CreateDirectoryBusinessInput = {
  slug: string
  name: string
  kind: BusinessKind
  description: string
  advantages: string
  scope: string
  productPitch: string
  whatsapp: string
}

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

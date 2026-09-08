export const BUSINESS_KINDS = ["food", "pharmacy"] as const
export type BusinessKind = (typeof BUSINESS_KINDS)[number]

export const USER_KINDS = ["admin", "business_owner", "rider"] as const
export type UserKind = (typeof USER_KINDS)[number]

export type SignedInUser = {
  tokenIdentifier: string
  email: string
  name: string
  kind: UserKind
  profileId: string | null
  businessId: string | null
}

export const RESERVED_BUSINESS_SLUGS = [
  "login",
  "register",
  "logout",
  "admin",
  "api",
  "rider",
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
  supportsDelivery: boolean
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

export const SALE_STATUSES = [
  "pending",
  "accepted",
  "completed",
  "cancelled",
] as const
export type SaleStatus = (typeof SALE_STATUSES)[number]

export const FULFILLMENT_MODES = ["delivery", "pickup"] as const
export type FulfillmentMode = (typeof FULFILLMENT_MODES)[number]

export type SaleView = {
  id: string
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  buyerName: string
  buyerPhone: string
  buyerLocation: string | null
  fulfillment: FulfillmentMode
  status: SaleStatus
  riderName: string | null
  createdAt: string
}

export type RiderView = {
  id: string
  name: string
  email: string
}

export const MAX_SALE_QUANTITY = 99

export const PAYMENT_METHODS = ["cash_on_delivery", "transfer"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const COUNTRY_ISO = "NI"
export const PHONE_COUNTRY_CODE = "505"
export const CURRENCY_CODE = "NIO"
export const CURRENCY_SYMBOL = "C$"

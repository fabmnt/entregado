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
  active: boolean
}

export const RESERVED_BUSINESS_SLUGS = [
  "login",
  "register",
  "logout",
  "admin",
  "api",
  "rider",
  "inactive",
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
  suspendedAt: number | null
  suspensionReason: string | null
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

export const ORDER_STATUSES = [
  "pending",
  "accepted",
  "completed",
  "cancelled",
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const FULFILLMENT_MODES = ["delivery", "pickup"] as const
export type FulfillmentMode = (typeof FULFILLMENT_MODES)[number]

export type OrderItemView = {
  id: string
  productId: string
  productName: string
  unitPrice: number
  quantity: number
}

export type OrderView = {
  id: string
  items: OrderItemView[]
  itemCount: number
  totalPrice: number
  buyerName: string
  buyerPhone: string
  buyerLocation: string | null
  fulfillment: FulfillmentMode
  status: OrderStatus
  paymentMethod: PaymentMethod | null
  paymentStatus: PaymentStatus
  riderName: string | null
  createdAt: string
}

export type PublicOrderView = OrderView & {
  completedAt: number | null
  cancelledAt: number | null
}

export type RiderView = {
  id: string
  name: string
  email: string
  active: boolean
}

export const MAX_ITEM_QUANTITY = 99
export const MAX_ORDER_ITEMS = 50

export const PAYMENT_METHODS = ["cash_on_delivery", "transfer"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_STATUSES = ["pending", "paid"] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const COUNTRY_ISO = "NI"
export const PHONE_COUNTRY_CODE = "505"
export const CURRENCY_CODE = "NIO"
export const CURRENCY_SYMBOL = "C$"

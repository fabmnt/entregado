import { MAX_ITEM_QUANTITY, MAX_ORDER_ITEMS } from "@entregado/types"
import type { StoreProduct } from "@entregado/types"
import type { AstroCookies } from "astro"
import { z } from "zod"

const CART_COOKIE_PREFIX = "entregado_cart_"
const CART_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(MAX_ITEM_QUANTITY),
})

export type CartItem = z.infer<typeof cartItemSchema>

export type CartLine = {
  productId: string
  quantity: number
  name: string
  unitPrice: number
  lineTotal: number
  supportsDelivery: boolean
}

function cookieName(slug: string): string {
  return `${CART_COOKIE_PREFIX}${slug}`
}

function parseCart(raw: string | undefined): CartItem[] {
  if (!raw) {
    return []
  }

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return []
  }

  const parsed = z.array(cartItemSchema).max(MAX_ORDER_ITEMS).safeParse(value)
  return parsed.success ? parsed.data : []
}

export function readCart(cookies: AstroCookies, slug: string): CartItem[] {
  return parseCart(cookies.get(cookieName(slug))?.value)
}

export function writeCart(
  cookies: AstroCookies,
  slug: string,
  items: CartItem[]
): void {
  cookies.set(cookieName(slug), JSON.stringify(items), {
    path: "/",
    maxAge: CART_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
  })
}

export function clearCart(cookies: AstroCookies, slug: string): void {
  cookies.delete(cookieName(slug), { path: "/" })
}

export function cartUnitCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0)
}

export function addCartItem(items: CartItem[], productId: string): CartItem[] {
  const existing = items.find((item) => item.productId === productId)
  if (existing) {
    return items.map((item) =>
      item.productId === productId && item.quantity < MAX_ITEM_QUANTITY
        ? { ...item, quantity: item.quantity + 1 }
        : item
    )
  }
  if (items.length >= MAX_ORDER_ITEMS) {
    return items
  }
  return [...items, { productId, quantity: 1 }]
}

export function setCartItemQuantity(
  items: CartItem[],
  productId: string,
  quantity: number
): CartItem[] {
  return items.map((item) =>
    item.productId === productId ? { ...item, quantity } : item
  )
}

export function removeCartItem(
  items: CartItem[],
  productId: string
): CartItem[] {
  return items.filter((item) => item.productId !== productId)
}

// Cart lines are priced from the live catalog, so a product the owner hid or
// deleted simply disappears from the order instead of showing a stale price.
export function toCartLines(
  items: CartItem[],
  products: StoreProduct[]
): CartLine[] {
  const lines: CartLine[] = []
  for (const item of items) {
    const product = products.find((row) => row.id === item.productId)
    if (!product) {
      continue
    }
    lines.push({
      productId: item.productId,
      quantity: item.quantity,
      name: product.name,
      unitPrice: product.price,
      lineTotal: product.price * item.quantity,
      supportsDelivery: product.supportsDelivery,
    })
  }
  return lines
}

import type { BusinessKind, DirectoryBusiness } from "@entregado/types"

export const HERO_IMAGE = "/images/hero.jpg"

const BUSINESS_KIND_LABELS: Record<BusinessKind, string> = {
  food: "Comida",
  pharmacy: "Farmacia",
}

const FOOD_IMAGES = [
  "/placeholders/food-1.jpg",
  "/placeholders/food-2.jpg",
  "/placeholders/food-3.jpg",
  "/placeholders/food-4.jpg",
] as const

const PHARMACY_IMAGES = [
  "/placeholders/pharmacy-1.jpg",
  "/placeholders/pharmacy-2.jpg",
  "/placeholders/pharmacy-3.jpg",
  "/placeholders/pharmacy-4.jpg",
] as const

function hashString(value: string): number {
  let hash = 0
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return hash
}

export function businessKindLabel(kind: BusinessKind): string {
  return BUSINESS_KIND_LABELS[kind]
}

// Businesses without an uploaded image get a stable stock photo for their kind.
export function businessImage(business: DirectoryBusiness): string {
  if (business.logoUrl) {
    return business.logoUrl
  }
  const pool = business.kind === "pharmacy" ? PHARMACY_IMAGES : FOOD_IMAGES
  return pool[hashString(business.slug) % pool.length]
}

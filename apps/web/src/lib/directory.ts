import type { BusinessKind, DirectoryBusiness } from "@entregado/types"

export const HERO_IMAGE = "/placeholders/hero.jpg"

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

export function businessPlaceholderImage(
  kind: BusinessKind,
  slug: string
): string {
  const pool = kind === "pharmacy" ? PHARMACY_IMAGES : FOOD_IMAGES
  return pool[hashString(slug) % pool.length]
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function asSentence(value: string): string {
  const text = value.trim()
  if (!text) {
    return ""
  }
  return /[.!?…]$/.test(text) ? text : `${text}.`
}

export function businessPortrait(business: DirectoryBusiness): string[] {
  const description = business.description.trim()
  const pitch = business.productPitch.trim()
  const advantages = business.advantages.trim()
  const scope = business.scope.trim()

  const paragraphs: string[] = []

  if (description) {
    paragraphs.push(description)
  }

  if (pitch && !sameText(pitch, description)) {
    paragraphs.push(pitch)
  }

  const extras: string[] = []
  for (const part of [advantages, scope]) {
    if (!part) {
      continue
    }
    const alreadyUsed =
      sameText(part, description) ||
      sameText(part, pitch) ||
      extras.some((item) => sameText(item, part))
    if (!alreadyUsed) {
      extras.push(part)
    }
  }

  if (extras.length > 1) {
    paragraphs.push(extras.map(asSentence).join(" "))
  } else if (extras[0]) {
    paragraphs.push(extras[0])
  }

  return paragraphs
}

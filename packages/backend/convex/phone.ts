import { ConvexError } from "convex/values"

const LOCAL_DIGITS = 8
const COUNTRY_PREFIX = "505"

export function parseNicaraguaE164(input: string): string {
  const digits = input.replace(/\D/g, "")
  const local =
    digits.startsWith(COUNTRY_PREFIX) && digits.length === 11
      ? digits.slice(COUNTRY_PREFIX.length)
      : digits

  if (!new RegExp(`^\\d{${LOCAL_DIGITS}}$`).test(local)) {
    throw new ConvexError("INVALID_PHONE")
  }

  return `+${COUNTRY_PREFIX}${local}`
}

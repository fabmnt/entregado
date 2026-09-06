import { PHONE_COUNTRY_CODE } from "@entregado/types"

const LOCAL_DIGITS = 8

export function isNicaraguaMobileOrLandline(localDigits: string): boolean {
  return /^\d{8}$/.test(localDigits)
}

export function toE164Nicaragua(localDigits: string): string {
  const digits = localDigits.replace(/\D/g, "")
  if (!isNicaraguaMobileOrLandline(digits)) {
    throw new Error(`Nicaragua numbers must have ${LOCAL_DIGITS} digits`)
  }
  return `+${PHONE_COUNTRY_CODE}${digits}`
}

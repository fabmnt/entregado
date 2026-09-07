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

export function parseNicaraguaPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "")
  const local =
    digits.startsWith(PHONE_COUNTRY_CODE) &&
    digits.length === PHONE_COUNTRY_CODE.length + LOCAL_DIGITS
      ? digits.slice(PHONE_COUNTRY_CODE.length)
      : digits

  if (!isNicaraguaMobileOrLandline(local)) {
    return null
  }

  return toE164Nicaragua(local)
}

export function nicaraguaLocalDigits(e164: string): string {
  const digits = e164.replace(/\D/g, "")
  if (
    digits.startsWith(PHONE_COUNTRY_CODE) &&
    digits.length === PHONE_COUNTRY_CODE.length + LOCAL_DIGITS
  ) {
    return digits.slice(PHONE_COUNTRY_CODE.length)
  }
  return digits
}

export function whatsappMeUrl(e164: string): string {
  return `https://wa.me/${e164.replace(/^\+/, "")}`
}

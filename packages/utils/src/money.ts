import { CURRENCY_SYMBOL } from "@entregado/types"

const cordobaFormatter = new Intl.NumberFormat("es-NI", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCordoba(amount: number): string {
  return `${CURRENCY_SYMBOL} ${cordobaFormatter.format(amount)}`
}

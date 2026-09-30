const isThousandsGrouped = (value: string, separator: string) =>
  new RegExp(`^\\d{1,3}(\\${separator}\\d{3})+$`).test(value)

// Convierte lo que escribe la persona en un número.
// Acepta coma o punto decimal ("1234,5", "1234.5") y separadores de miles bien
// agrupados ("1.234,56", "1,234.56", "1.234.567"). Un solo separador es el decimal,
// salvo que lo sigan exactamente 3 dígitos en un monto ("10.000" = diez mil).
// Devuelve null si el monto es inválido.
export function parseAmount(input: string, maxDecimals = 2): number | null {
  const value = input.replace(/\s/g, "")
  if (!/^\d[\d.,]*$/.test(value) || /[.,]$/.test(value)) return null

  const lastSeparatorIndex = Math.max(value.lastIndexOf("."), value.lastIndexOf(","))
  if (lastSeparatorIndex === -1) return Number(value)

  const separator = value[lastSeparatorIndex]
  const other = separator === "." ? "," : "."
  const separatorCount = value.split(separator).length - 1

  let integerPart: string
  let decimalPart = ""

  const trailingDigits = value.length - lastSeparatorIndex - 1
  const singleThousands =
    separatorCount === 1 && !value.includes(other) && trailingDigits === 3 && maxDecimals <= 2

  if ((separatorCount > 1 && !value.includes(other)) || singleThousands) {
    // "1.234.567" o "10.000" (un monto no lleva 3 decimales): el separador son miles.
    if (!isThousandsGrouped(value, separator)) return null
    integerPart = value
  } else {
    integerPart = value.slice(0, lastSeparatorIndex)
    decimalPart = value.slice(lastSeparatorIndex + 1)
    if (integerPart.includes(separator)) return null
    if (integerPart.includes(other) && !isThousandsGrouped(integerPart, other)) return null
  }

  if (decimalPart.length > maxDecimals) return null

  const parsed = Number(`${integerPart.replace(/[.,]/g, "")}.${decimalPart || "0"}`)
  return Number.isFinite(parsed) ? parsed : null
}

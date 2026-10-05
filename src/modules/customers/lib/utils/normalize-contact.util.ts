// Normaliza los datos de contacto para guardarlos y buscarlos siempre igual.
// Devuelven null si el valor está vacío y undefined si no es válido.

const VE_MOBILE_OR_LANDLINE = /^[24]\d{9}$/

// Teléfono → E.164. Sin "+" se asume Venezuela: 0414-123.45.67, 414 1234567 o 58 414 1234567.
export function normalizePhone(value: string | null | undefined): string | null | undefined {
  const raw = value?.trim() ?? ""
  if (!raw) return null
  const digits = raw.replace(/\D/g, "")

  if (raw.startsWith("+")) {
    if (digits.startsWith("58")) return VE_MOBILE_OR_LANDLINE.test(digits.slice(2)) ? `+${digits}` : undefined
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : undefined
  }
  if (digits.length === 12 && digits.startsWith("58")) return normalizePhone(`+${digits}`)
  if (digits.length === 11 && digits.startsWith("0")) return normalizePhone(`+58${digits.slice(1)}`)
  if (digits.length === 10) return normalizePhone(`+58${digits}`)
  return undefined
}

export function normalizeEmail(value: string | null | undefined): string | null | undefined {
  const email = value?.trim().toLowerCase() ?? ""
  if (!email) return null
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : undefined
}

// Instagram: acepta @usuario o el enlace del perfil.
export function normalizeInstagram(value: string | null | undefined): string | null | undefined {
  let handle = value?.trim().toLowerCase() ?? ""
  if (!handle) return null
  handle = handle.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, "").replace(/[/?].*$/, "").replace(/^@/, "")
  return /^[a-z0-9._]{1,30}$/.test(handle) ? handle : undefined
}

// Cédula o RIF → letra + números (V-12.345.678 → V12345678). Sin letra se asume V.
export function normalizeIdDocument(value: string | null | undefined): string | null | undefined {
  const raw = value?.trim().toUpperCase().replace(/[\s.\-]/g, "") ?? ""
  if (!raw) return null
  const withLetter = /^\d/.test(raw) ? `V${raw}` : raw
  return /^[VEJPG]\d{5,10}$/.test(withLetter) ? withLetter : undefined
}

// Para mostrar: +584141234567 → 0414-123.45.67 (otros países quedan en E.164).
export function formatPhone(phone: string): string {
  const match = /^\+58(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(phone)
  return match ? `0${match[1]}-${match[2]}.${match[3]}.${match[4]}` : phone
}

// Para mostrar: J123456789 → J-12345678-9 (RIF con dígito verificador); V12345678 → V-12345678.
export function formatTaxId(taxId: string): string {
  const match = /^([VEJPG])(\d+)$/.exec(taxId)
  if (!match) return taxId
  const [, letter, digits] = match
  return digits.length === 9 ? `${letter}-${digits.slice(0, 8)}-${digits.slice(8)}` : `${letter}-${digits}`
}

// Enlace de WhatsApp a partir del teléfono normalizado.
export const whatsappUrl = (phone: string) => `https://wa.me/${phone.replace("+", "")}`

// Para mostrar: J123456789 → J-12345678-9 (RIF con dígito verificador); V12345678 → V-12345678.
export function formatTaxId(taxId: string): string {
  const match = /^([VEJPG])(\d+)$/.exec(taxId)
  if (!match) return taxId
  const [, letter, digits] = match
  return digits.length === 9 ? `${letter}-${digits.slice(0, 8)}-${digits.slice(8)}` : `${letter}-${digits}`
}

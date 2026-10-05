// TLT + 00042 → "TLT00042"; desde la versión 2: "TLT00042-v2".
export function formatQuoteNumber(prefix: string, padding: number, number: number, version = 1): string {
  const base = `${prefix}${String(number).padStart(padding, "0")}`
  return version > 1 ? `${base}-v${version}` : base
}

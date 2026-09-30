import {
  CLOSURE_CODES,
  FIT_CODES,
  GENDER_CODES,
  type ProductClosure,
  type ProductFit,
  type ProductGender,
} from "../constants/products.constants"

export type SkuParts = {
  categoryCode: string
  gender?: ProductGender | null
  closure?: ProductClosure | null
  fit?: ProductFit | null
  colorCode?: string | null
  sizeCode?: string | null
}

// CAT-GÉNERO-CIERRE/CORTE-COLOR-TALLA, omitiendo lo que el producto no tiene.
// Ej.: Filipina dama broche vinotinta M → FIL-D-BR-VIN-M.
export function buildSku(parts: SkuParts): string {
  return [
    parts.categoryCode,
    parts.gender ? GENDER_CODES[parts.gender] : null,
    parts.closure ? CLOSURE_CODES[parts.closure] : null,
    parts.fit ? FIT_CODES[parts.fit] : null,
    parts.colorCode,
    parts.sizeCode,
  ]
    .filter(Boolean)
    .map((part) => normalizeSkuPart(part as string))
    .filter(Boolean)
    .join("-")
}

// Mayúsculas, sin acentos ni espacios: lo que acepta la base.
export function normalizeSkuPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}

export const SKU_PATTERN = /^[A-Z0-9]+(-[A-Z0-9]+)*$/

export function normalizeSku(value: string) {
  return value
    .trim()
    .toUpperCase()
    .split(/[-\s]+/)
    .map(normalizeSkuPart)
    .filter(Boolean)
    .join("-")
}

// Si el SKU base ya existe, agrega -2, -3…
export function uniqueSku(base: string, taken: ReadonlySet<string>) {
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

import { GENDERS, type ProductGender } from "@/modules/products/lib/constants/products.constants"

// Lo mínimo de una variante para elegirla con botones.
export type PickableVariant = {
  id: string
  gender: ProductGender | null
  color: { name: string; sort: number } | null
  size: { name: string; sort: number } | null
}

export type VariantSelection = { gender: ProductGender | null; color: string | null; size: string | null }

export type VariantChoices<T extends PickableVariant> = {
  genders: ProductGender[]
  colors: string[]
  sizes: string[]
  // La variante elegida, cuando la selección la define por completo.
  variant: T | null
}

const unique = <V>(values: V[]) => [...new Set(values)]

// Opciones para cada fila de botones: los géneros de todas las variantes, los colores del género
// elegido y las tallas del género y el color elegidos (así nunca se ofrece una combinación que no existe).
export function variantChoices<T extends PickableVariant>(variants: T[], selection: VariantSelection): VariantChoices<T> {
  const genders = GENDERS.filter((g) => variants.some((v) => v.gender === g))
  const ofGender = variants.filter((v) => genders.length === 0 || v.gender === selection.gender)
  const colors = unique(
    [...ofGender].sort((a, b) => (a.color?.sort ?? 0) - (b.color?.sort ?? 0) || (a.color?.name ?? "").localeCompare(b.color?.name ?? "")).flatMap((v) => (v.color ? [v.color.name] : []))
  )
  const ofColor = ofGender.filter((v) => colors.length === 0 || v.color?.name === selection.color)
  const sizes = unique([...ofColor].sort((a, b) => (a.size?.sort ?? 0) - (b.size?.sort ?? 0)).flatMap((v) => (v.size ? [v.size.name] : [])))
  const matches = ofColor.filter((v) => sizes.length === 0 || v.size?.name === selection.size)
  const complete = (genders.length === 0 || selection.gender) && (colors.length === 0 || selection.color) && (sizes.length === 0 || selection.size)
  return { genders, colors, sizes, variant: complete && matches.length === 1 ? matches[0] : null }
}

// Selección inicial: lo único que hay en cada fila queda elegido solo.
export function initialSelection<T extends PickableVariant>(variants: T[]): VariantSelection {
  const first = variantChoices(variants, { gender: null, color: null, size: null })
  const gender = first.genders.length === 1 ? first.genders[0] : null
  const second = variantChoices(variants, { gender, color: null, size: null })
  const color = second.colors.length === 1 ? second.colors[0] : null
  const third = variantChoices(variants, { gender, color, size: null })
  const size = third.sizes.length === 1 ? third.sizes[0] : null
  return { gender, color, size }
}

// Al cambiar una fila, lo que deja de existir en las siguientes se borra (p. ej. una talla que ese color no tiene).
export function changeSelection<T extends PickableVariant>(variants: T[], current: VariantSelection, patch: Partial<VariantSelection>): VariantSelection {
  let next = { ...current, ...patch }
  const afterGender = variantChoices(variants, next)
  if (next.color && !afterGender.colors.includes(next.color)) next = { ...next, color: null }
  if (!next.color && afterGender.colors.length === 1) next = { ...next, color: afterGender.colors[0] }
  const afterColor = variantChoices(variants, next)
  if (next.size && !afterColor.sizes.includes(next.size)) next = { ...next, size: null }
  if (!next.size && afterColor.sizes.length === 1) next = { ...next, size: afterColor.sizes[0] }
  return next
}

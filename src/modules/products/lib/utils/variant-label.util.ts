import { GENDER_LABELS, type ProductGender } from "../constants/products.constants"

type VariantParts = {
  gender?: ProductGender | null
  color: { name: string } | null
  size: { name: string } | null
}

// "Dama · Negro · M": género, color y talla de una variante (lo que tenga). Sin nada, "Única".
export function variantLabel(v: VariantParts | null | undefined): string {
  if (!v) return ""
  return [v.gender && GENDER_LABELS[v.gender], v.color?.name, v.size?.name].filter(Boolean).join(" · ") || "Única"
}

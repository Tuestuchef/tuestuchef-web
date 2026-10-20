import type { LineCustomization } from "../../components/customization-dialog"

// Lo que se envía a la base por cada personalización (de una línea o de una pieza de un combo).
export const customizationPayload = (c: LineCustomization) => ({
  type_id: c.typeId,
  quantity: c.quantity,
  text: c.text,
  names: c.names,
  logo_path: c.logoPath,
  position: c.position,
  size_cm: c.sizeCm,
  note: c.note,
  charged: c.charged,
})

// Personalizar una línea (su key) o una pieza de un combo ("<key>#<índice de la pieza>").
export const customizingTarget = (target: string | null) => {
  if (!target) return null
  const [lineKey, piece] = target.split("#")
  return { lineKey, pieceIndex: piece === undefined ? null : Number(piece) }
}

export const pieceTarget = (lineKey: string, pieceIndex: number) => `${lineKey}#${pieceIndex}`

// Toda la personalización de una línea: la suya y la de las piezas de su combo.
export const lineCustomizations = (line: { customizations: LineCustomization[]; components?: { customizations: LineCustomization[] }[] }) => [
  ...line.customizations,
  ...(line.components ?? []).flatMap((c) => c.customizations),
]

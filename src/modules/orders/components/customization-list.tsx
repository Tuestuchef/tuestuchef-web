"use client"

import { XIcon } from "lucide-react"

import { Button } from "@/common/components/ui/button"

import type { LineCustomization } from "./customization-dialog"

const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 })

type CustomizationListProps = {
  customizations: LineCustomization[]
  typeName: (typeId: string) => string | undefined
  onRemove: (key: string) => void
}

// La personalización ya agregada a una línea o a una pieza de un combo, con su botón para quitarla.
const CustomizationList = ({ customizations, typeName, onRemove }: CustomizationListProps) =>
  customizations.length === 0 ? null : (
    <ul className="grid gap-1 border-l-2 pl-2 text-xs">
      {customizations.map((c) => (
        <li key={c.key} className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            {quantityFormat.format(c.quantity)} × {typeName(c.typeId)}
            {c.names ? ` · ${c.names.length} nombres` : c.text ? `: ${c.text}` : ""}
            {c.logoPath && " · con archivo"}
            {c.position && ` · ${c.position}`}
            {c.sizeCm && ` · ${c.sizeCm} cm`}
            <span className="text-muted-foreground"> · {c.charged ? "se cobra" : "incluida"}</span>
          </span>
          <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => onRemove(c.key)}>
            <XIcon aria-hidden />
            <span className="sr-only">Quitar personalización</span>
          </Button>
        </li>
      ))}
    </ul>
  )

export default CustomizationList

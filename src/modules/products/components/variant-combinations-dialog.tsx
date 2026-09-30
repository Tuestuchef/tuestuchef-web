"use client"

import { CheckIcon, Grid3x3Icon } from "lucide-react"
import { useState } from "react"

import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/common/components/ui/dialog"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"
import { cn } from "@/common/lib/utils"

import { createVariantCombinationsAction } from "../lib/actions/save-variant.action"
import type { CatalogItem } from "../lib/types/products.types"

type MultiChipsProps = {
  label: string
  name: string
  items: CatalogItem[]
  selected: Set<string>
  onToggle: (id: string) => void
}

// Selección múltiple con botones grandes; lo marcado lleva check, no solo color.
const MultiChips = ({ label, name, items, selected, onToggle }: MultiChipsProps) => (
  <fieldset className="grid gap-2">
    <legend className="mb-2 text-sm font-medium">
      {label} <span className="font-normal text-muted-foreground">({selected.size})</span>
    </legend>
    {items.length === 0 ? (
      <p className="text-sm text-muted-foreground">No hay {label.toLowerCase()} activos en configuración.</p>
    ) : (
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const checked = selected.has(item.id)
          return (
            <button
              key={item.id}
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => onToggle(item.id)}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                checked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {checked && <CheckIcon className="size-4" aria-hidden />}
              {item.name}
            </button>
          )
        })}
      </div>
    )}
    {[...selected].map((id) => (
      <input key={id} type="hidden" name={name} value={id} />
    ))}
  </fieldset>
)

// Colores × tallas de una vez. Las combinaciones que ya existen se saltan.
const VariantCombinationsDialog = ({
  productId,
  colors,
  sizes,
}: {
  productId: string
  colors: CatalogItem[]
  sizes: CatalogItem[]
}) => {
  const [open, setOpen] = useState(false)
  const [colorIds, setColorIds] = useState<Set<string>>(new Set())
  const [sizeIds, setSizeIds] = useState<Set<string>>(new Set())
  const { state, onSubmit, pending } = useFormAction(createVariantCombinationsAction)
  useActionFeedback(state, () => {
    setOpen(false)
    setColorIds(new Set())
    setSizeIds(new Set())
  })

  const toggle = (setter: typeof setColorIds) => (id: string) =>
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const total = Math.max(colorIds.size, 1) * Math.max(sizeIds.size, 1)
  const nothing = colorIds.size === 0 && sizeIds.size === 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 md:h-9">
          <Grid3x3Icon aria-hidden />
          Colores × tallas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear variantes</DialogTitle>
          <DialogDescription>
            Marca los colores y las tallas. Se crea una variante por combinación, con su SKU.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-5" noValidate>
          <input type="hidden" name="product_id" value={productId} />
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          <MultiChips
            label="Colores"
            name="color_ids"
            items={colors.filter((c) => c.is_active)}
            selected={colorIds}
            onToggle={toggle(setColorIds)}
          />
          <MultiChips
            label="Tallas"
            name="size_ids"
            items={sizes.filter((s) => s.is_active)}
            selected={sizeIds}
            onToggle={toggle(setSizeIds)}
          />
          <SubmitButton pending={pending} disabled={nothing}>
            {nothing ? "Marca al menos un color o una talla" : `Crear hasta ${total} variantes`}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default VariantCombinationsDialog

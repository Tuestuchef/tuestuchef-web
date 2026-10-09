"use client"

import { MinusIcon, PlusIcon } from "lucide-react"
import { useState } from "react"

import ChoiceChips from "@/common/components/choice-chips"
import { Button } from "@/common/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/common/components/ui/dialog"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { GENDER_LABELS, type ProductGender } from "@/modules/products/lib/constants/products.constants"

import type { SellableVariant } from "../lib/types/sales.types"
import { changeSelection, initialSelection, type VariantSelection, variantChoices } from "../lib/utils/variant-picker.util"

type VariantPickerDialogProps = {
  // Las variantes de un producto (null = cerrado).
  variants: SellableVariant[] | null
  priceMethodId?: string
  // Stock disponible (descontando lo que ya está en la lista); sin esto no se muestra stock (presupuestos).
  available?: (variantId: string) => number
  onClose: () => void
  onAdd: (variant: SellableVariant, quantity: number) => void
}

const usd = (amount: number) => formatMoney(amount, "USD")

// Elegir género, color y talla con botones (en vez de buscar entre cientos de variantes) y la cantidad.
const VariantPickerDialog = ({ variants, priceMethodId, available, onClose, onAdd }: VariantPickerDialogProps) => (
  <Dialog open={variants !== null} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-h-[90svh] overflow-y-auto">
      {variants && variants.length > 0 && (
        // Montado por producto: cada vez empieza de cero.
        <PickerBody key={variants[0].productId} variants={variants} priceMethodId={priceMethodId} available={available} onClose={onClose} onAdd={onAdd} />
      )}
    </DialogContent>
  </Dialog>
)

const PickerBody = ({
  variants,
  priceMethodId,
  available,
  onClose,
  onAdd,
}: Omit<VariantPickerDialogProps, "variants"> & { variants: SellableVariant[] }) => {
  const [selection, setSelection] = useState<VariantSelection>(() => initialSelection(variants))
  const [quantity, setQuantity] = useState(1)
  const choices = variantChoices(variants, selection)
  const variant = choices.variant
  const change = (patch: Partial<VariantSelection>) => setSelection((current) => changeSelection(variants, current, patch))

  // Recargo de cada talla para el género y el color elegidos ("3XL +$3").
  const sizeHint = (size: string) => {
    const match = variants.find(
      (v) => v.size?.name === size && (choices.genders.length === 0 || v.gender === selection.gender) && (choices.colors.length === 0 || v.color?.name === selection.color)
    )
    return match && match.extraUsd > 0 ? `+${usd(match.extraUsd)}` : undefined
  }
  const price = variant && priceMethodId ? variant.pricesUsd[priceMethodId] : undefined
  const stock = variant && available ? available(variant.id) : null
  const madeToOrder = variant?.fulfillmentType === "made_to_order"

  const add = (keepOpen: boolean) => {
    if (!variant) return
    onAdd(variant, quantity)
    setQuantity(1)
    if (keepOpen) setSelection((current) => ({ ...current, size: null }))
    else onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{variants[0].productName}</DialogTitle>
        <DialogDescription>Elige {choices.genders.length > 0 && "el género, "}el color y la talla.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        {choices.genders.length > 0 && (
          <ChoiceRow label="Género">
            <ChoiceChips
              label="Género"
              options={choices.genders.map((g) => ({ value: g, label: GENDER_LABELS[g] }))}
              value={selection.gender}
              onChange={(gender) => change({ gender: gender as ProductGender })}
            />
          </ChoiceRow>
        )}
        {choices.colors.length > 0 && (choices.genders.length === 0 || selection.gender) && (
          <ChoiceRow label="Color">
            <ChoiceChips label="Color" options={choices.colors.map((c) => ({ value: c, label: c }))} value={selection.color} onChange={(color) => change({ color })} />
          </ChoiceRow>
        )}
        {choices.sizes.length > 0 && (choices.colors.length === 0 || selection.color) && (choices.genders.length === 0 || selection.gender) && (
          <ChoiceRow label="Talla">
            <ChoiceChips
              label="Talla"
              options={choices.sizes.map((s) => ({ value: s, label: s, hint: sizeHint(s) }))}
              value={selection.size}
              onChange={(size) => change({ size })}
            />
          </ChoiceRow>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div className="grid gap-0.5 text-sm">
            {variant ? (
              <>
                <span className="font-medium tabular-nums">{price === undefined ? "Sin precio en este método" : `${usd(price)} c/u`}</span>
                <span className="text-xs text-muted-foreground">
                  <code className="font-mono">{variant.sku}</code>
                  {madeToOrder ? " · por encargo" : stock !== null && ` · hay ${stock}`}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Elige para ver el precio</span>
            )}
          </div>
          <div className="flex items-center rounded-md border">
            <Button type="button" variant="ghost" size="icon" className="size-10 md:size-8" disabled={quantity <= 1} onClick={() => setQuantity((q) => q - 1)}>
              <MinusIcon aria-hidden />
              <span className="sr-only">Uno menos</span>
            </Button>
            <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
              {quantity}
            </span>
            <Button type="button" variant="ghost" size="icon" className="size-10 md:size-8" onClick={() => setQuantity((q) => q + 1)}>
              <PlusIcon aria-hidden />
              <span className="sr-only">Uno más</span>
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" className="h-11 md:h-9" disabled={!variant} onClick={() => add(true)}>
          Agregar y elegir otra
        </Button>
        <Button type="button" className="h-11 md:h-9" disabled={!variant} onClick={() => add(false)}>
          Agregar
        </Button>
      </DialogFooter>
    </>
  )
}

const ChoiceRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid gap-1.5">
    <span className="text-sm font-medium">{label}</span>
    {children}
  </div>
)

export default VariantPickerDialog

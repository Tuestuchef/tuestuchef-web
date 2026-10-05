"use client"

import { CheckIcon, MinusIcon, PlusIcon } from "lucide-react"
import { useMemo, useState } from "react"

import StatusBadge from "@/common/components/status-badge"
import { Button } from "@/common/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/common/components/ui/dialog"
import { cn } from "@/common/lib/utils"

import type { SaleLineSource } from "../lib/constants/sales.constants"
import type { SellableVariant } from "../lib/types/sales.types"

export type ComboSelection = {
  quantity: number
  components: { variantId: string; quantity: number; source: Exclude<SaleLineSource, "combo"> }[]
}

type ComboPickerDialogProps = {
  combo: SellableVariant | null
  variants: SellableVariant[]
  // Stock disponible de una variante, descontando lo que ya está en el carrito.
  available: (variantId: string) => number
  onCancel: () => void
  onConfirm: (selection: ComboSelection) => void
}

const Stepper = ({ value, onChange, label, max }: { value: number; onChange: (v: number) => void; label: string; max?: number }) => (
  <div className="flex items-center rounded-md border">
    <Button type="button" variant="ghost" size="icon" className="size-10 md:size-8" disabled={value <= 0} onClick={() => onChange(value - 1)}>
      <MinusIcon aria-hidden />
      <span className="sr-only">Uno menos de {label}</span>
    </Button>
    <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
      {value}
    </span>
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-10 md:size-8"
      disabled={max !== undefined && value >= max}
      onClick={() => onChange(value + 1)}
    >
      <PlusIcon aria-hidden />
      <span className="sr-only">Uno más de {label}</span>
    </Button>
  </div>
)

// Origen de una pieza: de inventario si hay; si el producto se hace por encargo (o no hay), por encargo.
const sourceFor = (variant: SellableVariant, wanted: number, available: number): ComboSelection["components"][number]["source"] =>
  variant.fulfillmentType === "made_to_order" || (variant.fulfillmentType === "both" && available < wanted) ? "made_to_order" : "stock"

// Elegir la talla y el color de cada pieza del combo. Con varios combos se pueden mezclar tallas.
const ComboPickerDialog = ({ combo, variants, available, onCancel, onConfirm }: ComboPickerDialogProps) => {
  const [quantity, setQuantity] = useState(1)
  const [picked, setPicked] = useState<Record<string, number>>({})

  const optionsByProduct = useMemo(() => {
    const map = new Map<string, SellableVariant[]>()
    for (const v of variants) {
      if (v.components) continue
      map.set(v.productId, [...(map.get(v.productId) ?? []), v])
    }
    return map
  }, [variants])

  const components = combo?.components ?? []
  // Un producto con una sola variante se completa solo.
  const amountOf = (productId: string, variantId: string, required: number) => {
    const options = optionsByProduct.get(productId) ?? []
    return options.length === 1 ? required : (picked[variantId] ?? 0)
  }

  const groups = components.map((component) => {
    const required = component.quantity * quantity
    const options = optionsByProduct.get(component.productId) ?? []
    const rows = options.map((variant) => {
      const amount = amountOf(component.productId, variant.id, required)
      const stock = available(variant.id)
      const source = sourceFor(variant, amount, stock)
      return { variant, amount, stock, source, short: source === "stock" && amount > stock }
    })
    const chosen = rows.reduce((sum, r) => sum + r.amount, 0)
    return { component, required, rows, chosen, complete: chosen === required, short: rows.some((r) => r.short) }
  })
  const ready = groups.length > 0 && groups.every((g) => g.complete && !g.short && g.rows.length > 0)

  const close = () => {
    setQuantity(1)
    setPicked({})
  }

  const confirm = () => {
    onConfirm({
      quantity,
      components: groups.flatMap((g) =>
        g.rows.filter((r) => r.amount > 0).map((r) => ({ variantId: r.variant.id, quantity: r.amount, source: r.source }))
      ),
    })
    close()
  }

  return (
    <Dialog
      open={combo !== null}
      onOpenChange={(open) => {
        if (!open) {
          close()
          onCancel()
        }
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{combo?.productName}</DialogTitle>
          <DialogDescription>Elige la talla y el color de cada pieza. El stock se descuenta de cada una.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <span className="text-sm font-medium">Cantidad de combos</span>
          <Stepper value={quantity} onChange={(v) => setQuantity(Math.max(1, v))} label="combos" />
        </div>

        <div className="grid gap-4">
          {groups.map(({ component, required, rows, chosen, complete, short }) => (
            <section key={component.productId} className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{component.productName}</h3>
                {rows.length === 0 ? (
                  <StatusBadge tone="error">Sin variantes activas</StatusBadge>
                ) : complete && !short ? (
                  <StatusBadge tone="success">
                    {chosen} de {required}
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="warning">
                    {chosen} de {required}
                  </StatusBadge>
                )}
              </div>
              <ul className="divide-y rounded-lg border">
                {rows.map(({ variant, amount, stock, source, short: isShort }) => (
                  <li key={variant.id} className={cn("flex items-center gap-3 p-2.5", amount > 0 && "bg-muted/50")}>
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <span className="flex items-center gap-1.5 text-sm">
                        {amount > 0 && <CheckIcon className="size-3.5" aria-hidden />}
                        {variant.variantLabel}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {source === "made_to_order" ? "Por encargo" : `Hay ${stock}`}
                        {isShort && " · no alcanza"}
                      </span>
                    </div>
                    {rows.length > 1 && (
                      <Stepper
                        value={amount}
                        label={variant.variantLabel}
                        max={required - chosen + amount}
                        onChange={(v) => setPicked((prev) => ({ ...prev, [variant.id]: v }))}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" className="h-11 md:h-9" disabled={!ready} onClick={confirm}>
            Agregar {quantity > 1 ? `${quantity} combos` : "combo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ComboPickerDialog

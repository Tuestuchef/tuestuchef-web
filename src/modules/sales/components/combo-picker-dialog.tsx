"use client"

import { CheckIcon, MinusIcon, PlusIcon } from "lucide-react"
import { useMemo, useState } from "react"

import ChoiceChips from "@/common/components/choice-chips"
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
import { formatMoney } from "@/common/lib/utils/format-money.util"

import type { SaleLineSource } from "../lib/constants/sales.constants"
import type { SellableVariant } from "../lib/types/sales.types"
import { comboExtraUsd, shortNames } from "../lib/utils/combo.util"
import { round } from "../lib/utils/sale-math.util"

export type ComboSelection = {
  quantity: number
  components: { variantId: string; quantity: number; source: Exclude<SaleLineSource, "combo"> }[]
}

type ComboPickerDialogProps = {
  combo: SellableVariant | null
  variants: SellableVariant[]
  // Stock disponible de una variante, descontando lo que ya está en el carrito.
  available: (variantId: string) => number
  // Método de la lista de precios, para mostrar el total con recargos.
  priceMethodId?: string
  onCancel: () => void
  onConfirm: (selection: ComboSelection) => void
}

const usd = (value: number) => formatMoney(value, "USD")

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

// Elegir las piezas del combo: en cada componente el producto (si acepta varios), la talla y el color.
// Con varios combos se pueden mezclar productos y tallas. Las piezas con recargo lo suman al combo.
const ComboPickerDialog = ({ combo, variants, available, priceMethodId, onCancel, onConfirm }: ComboPickerDialogProps) => {
  const [quantity, setQuantity] = useState(1)
  const [picked, setPicked] = useState<Record<string, number>>({})
  // Producto que se está mostrando en cada componente (si acepta varios).
  const [shown, setShown] = useState<Record<string, string>>({})

  const variantsByProduct = useMemo(() => {
    const map = new Map<string, SellableVariant[]>()
    for (const v of variants) {
      if (v.components) continue
      map.set(v.productId, [...(map.get(v.productId) ?? []), v])
    }
    return map
  }, [variants])

  const components = combo?.components ?? []

  const groups = components.map((component) => {
    const required = component.quantity * quantity
    const all = component.products.flatMap((p) => variantsByProduct.get(p.productId) ?? [])
    // Un componente con una sola variante para elegir se completa solo.
    const single = all.length === 1
    const rows = all.map((variant) => {
      const amount = single ? required : (picked[variant.id] ?? 0)
      const stock = available(variant.id)
      const source = sourceFor(variant, amount, stock)
      return { variant, amount, stock, source, short: source === "stock" && amount > stock }
    })
    const chosen = rows.reduce((sum, r) => sum + r.amount, 0)
    const products = component.products.filter((p) => variantsByProduct.has(p.productId))
    const names = shortNames(products.map((p) => p.productName))
    const shownId = shown[component.id] ?? products[0]?.productId
    return {
      component,
      required,
      rows,
      single,
      chosen,
      products: products.map((p, i) => ({
        ...p,
        short: names[i],
        picked: rows.filter((r) => r.variant.productId === p.productId).reduce((sum, r) => sum + r.amount, 0),
      })),
      shownId,
      complete: chosen === required,
      short: rows.some((r) => r.short),
    }
  })
  const ready = groups.length > 0 && groups.every((g) => g.complete && !g.short && g.rows.length > 0)

  const selection = groups.flatMap((g) =>
    g.rows.filter((r) => r.amount > 0).map((r) => ({ variantId: r.variant.id, quantity: r.amount, source: r.source }))
  )
  const extra = comboExtraUsd(selection, (id) => variants.find((v) => v.id === id)?.extraUsd)
  const comboPrice = priceMethodId ? combo?.pricesUsd[priceMethodId] : undefined

  const close = () => {
    setQuantity(1)
    setPicked({})
    setShown({})
  }

  const confirm = () => {
    onConfirm({ quantity, components: selection })
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
          <DialogDescription>
            Elige cada pieza: el modelo (si hay varios), la talla y el color. El stock se descuenta de cada una; si una cobra recargo, se suma al
            combo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <span className="text-sm font-medium">Cantidad de combos</span>
          <Stepper value={quantity} onChange={(v) => setQuantity(Math.max(1, v))} label="combos" />
        </div>

        <div className="grid gap-4">
          {groups.map(({ component, required, rows, single, chosen, products, shownId, complete, short }) => (
            <section key={component.id} className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{component.name}</h3>
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
              {products.length > 1 && (
                <ChoiceChips
                  label={`Modelo de ${component.name}`}
                  options={products.map((p) => ({ value: p.productId, label: p.short, hint: p.picked > 0 ? `· ${p.picked}` : undefined }))}
                  value={shownId ?? null}
                  onChange={(value) => setShown((prev) => ({ ...prev, [component.id]: value }))}
                />
              )}
              <ul className="divide-y rounded-lg border">
                {rows
                  .filter((r) => products.length <= 1 || r.variant.productId === shownId)
                  .map(({ variant, amount, stock, source, short: isShort }) => (
                    <li key={variant.id} className={cn("flex items-center gap-3 p-2.5", amount > 0 && "bg-muted/50")}>
                      <div className="grid min-w-0 flex-1 gap-0.5">
                        <span className="flex items-center gap-1.5 text-sm">
                          {amount > 0 && <CheckIcon className="size-3.5" aria-hidden />}
                          {variant.variantLabel}
                          {variant.extraUsd > 0 && <span className="text-xs text-muted-foreground tabular-nums">+{usd(variant.extraUsd)}</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {source === "made_to_order" ? "Por encargo" : `Hay ${stock}`}
                          {isShort && " · no alcanza"}
                        </span>
                      </div>
                      {!single && (
                        <Stepper
                          value={amount}
                          label={`${variant.productName} ${variant.variantLabel}`}
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
            {comboPrice !== undefined
              ? ` · ${usd(round(comboPrice * quantity + extra))}`
              : extra > 0 && ` (+${usd(extra)} de recargo)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ComboPickerDialog

"use client"

import { BadgeDollarSignIcon } from "lucide-react"
import { useState } from "react"

import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/common/components/ui/dialog"
import { Input } from "@/common/components/ui/input"
import { Label } from "@/common/components/ui/label"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { saveSizeSurchargesAction } from "../lib/actions/save-size-surcharges.action"
import type { SizeSurchargeProduct } from "../lib/types/products.types"

type SizeSurchargesDialogProps = {
  size: { id: string; name: string }
  products: SizeSurchargeProduct[]
  // Recargo actual por producto (USD).
  current: Record<string, number>
}

const toText = (amount: number | undefined) => (amount === undefined ? "" : String(amount).replace(".", ","))

// Recargo de una talla (p. ej. 3XL) en los productos que lo cobran: se suma a su precio en todos los métodos.
const SizeSurchargesDialog = ({ size, products, current }: SizeSurchargesDialogProps) => {
  const [open, setOpen] = useState(false)
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(Object.keys(current).map((id) => [id, true])))
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(current).map(([id, amount]) => [id, toText(amount)]))
  )
  const [bulk, setBulk] = useState("")
  const { state, onSubmit, pending } = useFormAction(saveSizeSurchargesAction)
  useActionFeedback(state, () => setOpen(false))

  const count = Object.keys(current).length
  const categories = [...new Set(products.map((p) => p.categoryName))]
  const markedCount = products.filter((p) => checked[p.id]).length

  const toggleCategory = (category: string, value: boolean) =>
    setChecked((all) => ({ ...all, ...Object.fromEntries(products.filter((p) => p.categoryName === category).map((p) => [p.id, value])) }))

  const applyBulk = () =>
    setAmounts((all) => ({ ...all, ...Object.fromEntries(products.filter((p) => checked[p.id]).map((p) => [p.id, bulk])) }))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Recargos de la talla ${size.name}`}>
          <BadgeDollarSignIcon aria-hidden />
          {count > 0 ? `Recargo · ${count}` : "Recargo"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Recargo de la talla {size.name}</DialogTitle>
          <DialogDescription>
            Marca los productos que cuestan más en esta talla y cuánto más (USD). Se suma a su precio en todos los métodos de pago; lo ya
            vendido no cambia.
          </DialogDescription>
        </DialogHeader>

        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay productos activos.</p>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <input type="hidden" name="size_id" value={size.id} />
            {/* Un campo por producto: vacío (o sin marcar) quita el recargo. */}
            {products.map((p) => (
              <input key={p.id} type="hidden" name={`surcharge_${p.id}`} value={checked[p.id] ? (amounts[p.id] ?? "") : ""} />
            ))}
            {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

            <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
              <div className="grid flex-1 gap-1.5">
                <Label htmlFor={`bulk-${size.id}`}>Mismo monto para los marcados</Label>
                <Input
                  id={`bulk-${size.id}`}
                  value={bulk}
                  onChange={(e) => setBulk(e.target.value)}
                  inputMode="decimal"
                  placeholder="3,00"
                  className="h-11 md:h-9"
                />
              </div>
              <Button type="button" variant="outline" className="h-11 md:h-9" onClick={applyBulk} disabled={!bulk.trim() || markedCount === 0}>
                Aplicar a {markedCount}
              </Button>
            </div>

            {categories.map((category) => {
              const inCategory = products.filter((p) => p.categoryName === category)
              const allChecked = inCategory.every((p) => checked[p.id])
              return (
                <fieldset key={category} className="grid gap-1">
                  <legend className="mb-1 flex w-full items-center justify-between gap-2 text-sm font-semibold">
                    {category}
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleCategory(category, !allChecked)}>
                      {allChecked ? "Quitar todos" : "Marcar todos"}
                    </Button>
                  </legend>
                  {inCategory.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 py-1">
                      <input
                        id={`check-${size.id}-${p.id}`}
                        type="checkbox"
                        checked={Boolean(checked[p.id])}
                        onChange={(e) => setChecked((all) => ({ ...all, [p.id]: e.target.checked }))}
                        className="size-5 shrink-0 accent-primary"
                      />
                      <Label htmlFor={`check-${size.id}-${p.id}`} className="min-w-0 flex-1 font-normal">
                        {p.name}
                      </Label>
                      <div className="flex w-28 items-center gap-1">
                        <span className="text-sm text-muted-foreground">+$</span>
                        <Input
                          aria-label={`Recargo de ${p.name} en ${size.name}`}
                          value={amounts[p.id] ?? ""}
                          onChange={(e) => {
                            setAmounts((all) => ({ ...all, [p.id]: e.target.value }))
                            if (e.target.value.trim()) setChecked((all) => ({ ...all, [p.id]: true }))
                          }}
                          inputMode="decimal"
                          placeholder="0,00"
                          className="h-11 md:h-9"
                        />
                      </div>
                    </div>
                  ))}
                </fieldset>
              )
            })}

            <SubmitButton pending={pending}>Guardar recargos</SubmitButton>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default SizeSurchargesDialog

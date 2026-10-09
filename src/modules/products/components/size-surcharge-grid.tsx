"use client"

import { WandSparklesIcon } from "lucide-react"
import { useState } from "react"

import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import { Input } from "@/common/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/common/components/ui/select"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"

import { saveProductSizeSurchargesAction } from "../lib/actions/save-size-surcharges.action"
import { GENDER_LABELS, type ProductGender } from "../lib/constants/products.constants"
import type { SizeSurchargeRow } from "../lib/types/products.types"
import { cellKey, cumulativeSurcharges, initialCells } from "../lib/utils/size-surcharges.util"

type SizeSurchargeGridProps = {
  productId: string
  // Géneros del producto; sin géneros, una sola columna (todos).
  genders: ProductGender[]
  // Tallas que usan sus variantes, en orden.
  sizes: { id: string; name: string }[]
  rows: SizeSurchargeRow[]
  // Precio base del primer método, para mostrar el precio final de cada talla.
  base: { methodName: string; amountUsd: number } | null
  canManage: boolean
}

const toText = (amount: number | undefined) => (amount === undefined ? "" : String(amount).replace(".", ","))
const usd = (amount: number) => formatMoney(amount, "USD")

// "Precio por talla": cuánto más cuesta cada talla, por género (p. ej. caballero desde 3XL +$3 por
// talla; dama solo 6XL). Se suma al precio en todos los métodos de pago.
const SizeSurchargeGrid = ({ productId, genders, sizes, rows, base, canManage }: SizeSurchargeGridProps) => {
  const columns: (ProductGender | null)[] = genders.length ? genders : [null]
  const sizeIds = sizes.map((s) => s.id)
  const [cells, setCells] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initialCells(rows, sizeIds, columns)).map(([k, v]) => [k, toText(v)]))
  )
  const [shortcut, setShortcut] = useState<{ gender: string; from: string; step: string }>({
    gender: columns[0] ?? "",
    from: sizes.find((s) => /3XL/i.test(s.name))?.id ?? sizes[0]?.id ?? "",
    step: "",
  })
  const { state, onSubmit, pending } = useFormAction(saveProductSizeSurchargesAction)
  useActionFeedback(state)

  if (sizes.length === 0) return <p className="text-sm text-muted-foreground">Crea variantes con talla para cargar su precio por talla.</p>

  const columnLabel = (g: ProductGender | null) => (g ? GENDER_LABELS[g] : "Recargo")
  const payload = Object.entries(cells).flatMap(([key, text]) => {
    const amount = parseAmount(text)
    if (amount === null || amount <= 0) return []
    const [sizeId, gender] = key.split("|")
    return [{ size_id: sizeId, gender: gender || null, amount_usd: amount }]
  })

  const applyShortcut = () => {
    const gender = (shortcut.gender || null) as ProductGender | null
    const filled = cumulativeSurcharges(sizeIds, shortcut.from, parseAmount(shortcut.step) ?? 0)
    setCells((all) => ({ ...all, ...Object.fromEntries(Object.entries(filled).map(([sizeId, v]) => [cellKey(sizeId, gender), toText(v)])) }))
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="rows" value={JSON.stringify(payload)} />
      {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

      {canManage && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3 text-sm">
          {columns.length > 1 && (
            <Select value={shortcut.gender} onValueChange={(gender) => setShortcut((s) => ({ ...s, gender }))}>
              <SelectTrigger aria-label="Género del atajo" className="h-11 w-36 md:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((g) => (
                  <SelectItem key={g ?? "all"} value={g ?? ""}>
                    {columnLabel(g)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className="self-center">desde</span>
          <Select value={shortcut.from} onValueChange={(from) => setShortcut((s) => ({ ...s, from }))}>
            <SelectTrigger aria-label="Talla desde" className="h-11 w-24 md:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="self-center">+$</span>
          <Input
            aria-label="Monto por talla"
            value={shortcut.step}
            onChange={(e) => setShortcut((s) => ({ ...s, step: e.target.value }))}
            inputMode="decimal"
            placeholder="3,00"
            className="h-11 w-20 md:h-9"
          />
          <span className="self-center">por talla</span>
          <Button type="button" variant="outline" className="h-11 md:h-9" onClick={applyShortcut} disabled={!(parseAmount(shortcut.step) ?? 0)}>
            <WandSparklesIcon aria-hidden />
            Llenar
          </Button>
        </div>
      )}

      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[18rem] text-sm tabular-nums">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 font-medium">Talla</th>
              {columns.map((g) => (
                <th key={g ?? "all"} className="py-2 font-medium">
                  {columnLabel(g)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizes.map((size) => (
              <tr key={size.id} className="border-b last:border-0">
                <td className="py-1.5 font-medium">{size.name}</td>
                {columns.map((g) => {
                  const key = cellKey(size.id, g)
                  const amount = parseAmount(cells[key] ?? "") ?? 0
                  return (
                    <td key={key} className="py-1.5 pr-2">
                      {canManage ? (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">+$</span>
                          <Input
                            aria-label={`Recargo ${size.name}${g ? ` ${GENDER_LABELS[g]}` : ""}`}
                            value={cells[key] ?? ""}
                            onChange={(e) => setCells((all) => ({ ...all, [key]: e.target.value }))}
                            inputMode="decimal"
                            placeholder="0"
                            className="h-10 w-20 md:h-8"
                          />
                        </div>
                      ) : (
                        <span>{amount > 0 ? `+${usd(amount)}` : "—"}</span>
                      )}
                      {base && amount > 0 && <span className="block text-xs text-muted-foreground">= {usd(base.amountUsd + amount)}</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {base && <p className="text-xs text-muted-foreground">El precio final es el de {base.methodName} ({usd(base.amountUsd)}) + el recargo; se suma igual en todos los métodos.</p>}
      {canManage && (
        <SubmitButton pending={pending} className="w-fit">
          Guardar precio por talla
        </SubmitButton>
      )}
    </form>
  )
}

export default SizeSurchargeGrid

"use client"

import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Input } from "@/common/components/ui/input"
import { Label } from "@/common/components/ui/label"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { saveProductPricesAction } from "../lib/actions/save-prices.action"

type PriceGridProps = {
  productId: string
  methods: { id: string; name: string }[]
  prices: Record<string, number>
  canManage: boolean
}

const usdFormat = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Precio de referencia en USD por método de pago. El monto en Bs se calcula al vender con la tasa BCV del día.
const PriceGrid = ({ productId, methods, prices, canManage }: PriceGridProps) => {
  const { state, onSubmit, pending } = useFormAction(saveProductPricesAction)
  useActionFeedback(state)

  if (methods.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay métodos de pago activos.</p>
  }

  if (!canManage) {
    return (
      <dl className="grid gap-2 text-sm">
        {methods.map((method) => (
          <div key={method.id} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{method.name}</dt>
            <dd className="tabular-nums">{method.id in prices ? `$ ${usdFormat.format(prices[method.id])}` : "—"}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <input type="hidden" name="product_id" value={productId} />
      {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
      {methods.map((method) => (
        <div key={method.id} className="grid grid-cols-[1fr_8rem] items-center gap-3">
          <Label htmlFor={`price-${method.id}`} className="font-normal">
            {method.name}
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id={`price-${method.id}`}
              name={`price_${method.id}`}
              inputMode="decimal"
              placeholder="—"
              defaultValue={method.id in prices ? String(prices[method.id]) : ""}
              className="h-11 pl-7 text-right tabular-nums md:h-9"
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Vacío = no se vende con ese método.</p>
      <SubmitButton pending={pending}>Guardar precios</SubmitButton>
    </form>
  )
}

export default PriceGrid

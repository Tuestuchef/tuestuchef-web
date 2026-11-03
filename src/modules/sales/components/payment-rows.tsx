"use client"

import { Trash2Icon } from "lucide-react"

import { Button } from "@/common/components/ui/button"
import { Input } from "@/common/components/ui/input"
import type { Currency } from "@/common/lib/constants/currency.constants"

export type PaymentRow = { key: number; methodId: string; amount: string }

type PaymentRowsProps = {
  rows: PaymentRow[]
  methods: { id: string; name: string; currency: Currency }[]
  onChange: (rows: PaymentRow[]) => void
}

// Los pagos de una venta o un pedido (abono o mixto): cada uno en su caja, con el método arriba y
// el monto abajo, para que en el celular quepa y se distinga un pago de otro.
const PaymentRows = ({ rows, methods, onChange }: PaymentRowsProps) => {
  const update = (key: number, patch: Partial<PaymentRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  return (
    <ul className="grid gap-2">
      {rows.map((row, index) => {
        const currency = methods.find((m) => m.id === row.methodId)?.currency ?? "USD"
        return (
          <li
            key={row.key}
            className="grid min-w-0 gap-2 rounded-lg border p-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-200"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Pago {index + 1}</span>
              <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => onChange(rows.filter((r) => r.key !== row.key))}>
                <Trash2Icon aria-hidden />
                <span className="sr-only">Quitar el pago {index + 1}</span>
              </Button>
            </div>
            <select
              aria-label={`Método del pago ${index + 1}`}
              value={row.methodId}
              onChange={(e) => update(row.key, { methodId: e.target.value })}
              className="h-11 w-full min-w-0 truncate rounded-md border bg-background px-2 text-sm md:h-9"
            >
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <div className="relative">
              <Input
                aria-label={`Monto del pago ${index + 1} en ${currency}`}
                inputMode="decimal"
                value={row.amount}
                onChange={(e) => update(row.key, { amount: e.target.value })}
                placeholder="0,00"
                className="h-11 pr-14 text-right tabular-nums md:h-9"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default PaymentRows

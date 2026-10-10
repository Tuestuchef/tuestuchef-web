import { HistoryIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/common/components/ui/card"
import { formatDate, formatTime } from "@/common/lib/utils/format-date.util"
import { formatMoney } from "@/common/lib/utils/format-money.util"

import { CHANNEL_LABELS, DELIVERY_LABELS, type DeliveryMethod, type SaleChannel } from "../lib/constants/sales.constants"
import type { PaymentSnapshot, SaleEdit, SaleEditChange } from "../lib/types/sales.types"

const FIELD_LABELS: Record<SaleEditChange["field"], string> = {
  customer: "Cliente",
  channel: "Canal",
  delivery_method: "Entrega",
  notes: "Notas",
  payment: "Pago",
}

const payment = (p: PaymentSnapshot) => `${p.method} ${formatMoney(p.amount, p.currency)}`

// Un valor del historial en palabras ("—" si estaba vacío).
const describe = (change: SaleEditChange, side: "from" | "to") => {
  if (change.field === "payment") {
    const value = change[side]
    return value ? payment(value) : "quitado (por cobrar)"
  }
  const value = change[side]
  if (!value) return change.field === "customer" ? "sin cliente" : "—"
  if (change.field === "channel") return CHANNEL_LABELS[value as SaleChannel] ?? value
  if (change.field === "delivery_method") return DELIVERY_LABELS[value as DeliveryMethod] ?? value
  return value
}

// Cambios hechos a la venta después de registrarla: quién, cuándo, por qué y qué cambió.
const SaleEditHistory = ({ edits }: { edits: SaleEdit[] }) => {
  if (edits.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HistoryIcon className="size-4" aria-hidden />
          Historial de cambios
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="divide-y">
          {[...edits].reverse().map((edit) => (
            <li key={edit.id} className="grid gap-1 py-2.5">
              <span className="text-xs text-muted-foreground">
                {formatDate(edit.at)} · {formatTime(edit.at)} · {edit.byName ?? "—"}
              </span>
              <ul className="grid gap-0.5 text-sm">
                {edit.changes.map((change, index) => (
                  <li key={index}>
                    <span className="font-medium">{FIELD_LABELS[change.field]}:</span>{" "}
                    <span className="text-muted-foreground line-through">{describe(change, "from")}</span> → {describe(change, "to")}
                  </li>
                ))}
              </ul>
              <span className="text-xs text-muted-foreground">Motivo: {edit.reason}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

export default SaleEditHistory

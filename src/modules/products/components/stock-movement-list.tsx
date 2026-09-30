import { MinusIcon, PlusIcon } from "lucide-react"

import { formatDate } from "@/common/lib/utils/format-date.util"
import { formatUsdt } from "@/common/lib/utils/format-money.util"

import { MOVEMENT_TYPE_LABELS } from "../lib/constants/products.constants"
import type { StockMovementItem } from "../lib/types/products.types"

const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 })

type StockMovementListProps = {
  movements: StockMovementItem[]
  showProduct?: boolean
  showAuthor?: boolean
}

// Entradas y salidas: el signo va con icono y texto, no solo con color.
const StockMovementList = ({ movements, showProduct = true, showAuthor = false }: StockMovementListProps) => {
  if (movements.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay movimientos de stock.</p>
  }

  return (
    <ul className="divide-y">
      {movements.map((m) => {
        const isIn = m.quantity > 0
        const Icon = isIn ? PlusIcon : MinusIcon
        return (
          <li key={m.id} className="flex items-start gap-3 py-2.5">
            <div className="grid min-w-0 flex-1 gap-0.5">
              <span className="text-sm font-medium">
                {MOVEMENT_TYPE_LABELS[m.movementType]}
                {showProduct && <span className="font-normal text-muted-foreground"> · {m.productName}</span>}
              </span>
              <span className="text-xs text-muted-foreground">
                <code className="font-mono">{m.sku}</code>
                {` · ${formatDate(m.occurredAt)}`}
                {m.unitCostUsdt !== null && ` · ${formatUsdt(m.unitCostUsdt)} c/u`}
                {showAuthor && m.authorName && ` · por ${m.authorName}`}
              </span>
              {m.note && <span className="truncate text-xs text-muted-foreground">{m.note}</span>}
            </div>
            <span className="inline-flex items-center gap-0.5 text-sm font-medium tabular-nums">
              <Icon className="size-3.5" aria-hidden />
              <span className="sr-only">{isIn ? "Entrada de" : "Salida de"}</span>
              {quantityFormat.format(Math.abs(m.quantity))}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export default StockMovementList

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import { formatUsdt } from "@/common/lib/utils/format-money.util"
import { CATEGORY_TYPE_LABELS } from "@/modules/money-movements/lib/constants/money-movements.constants"

import { PROFIT_USE_TYPES } from "../lib/constants/analytics.constants"
import type { CategoryAmount } from "../lib/types/analytics.types"

// A dónde se va el dinero. La barra da la proporción; la cifra y el % van en texto.
const OutflowBreakdown = ({ items }: { items: CategoryAmount[] }) => {
  const total = items.reduce((sum, item) => sum + Math.max(item.amount, 0), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>A dónde va el dinero</CardTitle>
        <CardDescription>Salidas del período por categoría, en USDT</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin salidas en este período.</p>
        ) : (
          <ul className="grid gap-3">
            {items.map((item) => {
              const share = total > 0 ? Math.max(item.amount, 0) / total : 0
              const isProfitUse = PROFIT_USE_TYPES.includes(item.type)
              return (
                <li key={`${item.type}-${item.name}`} className="grid gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{item.name}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        {CATEGORY_TYPE_LABELS[item.type]}
                        {isProfitUse ? " · sale de la utilidad" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatUsdt(item.amount)}{" "}
                      <span className="text-xs text-muted-foreground">{Math.round(share * 100)}%</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div
                      className={isProfitUse ? "h-full rounded-full bg-chart-3" : "h-full rounded-full bg-negative"}
                      style={{ width: `${share * 100}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export default OutflowBreakdown

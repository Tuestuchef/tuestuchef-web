import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"

import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { Card, CardContent } from "@/common/components/ui/card"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatDate } from "@/common/lib/utils/format-date.util"
import { formatMoney } from "@/common/lib/utils/format-money.util"

import { formatPurchaseNumber } from "../lib/constants/purchases.constants"
import { listPayables } from "../lib/services/purchases.service"

// Cuentas por pagar (owner y admin): las vencidas primero, luego por vencimiento.
const PayablesScreen = async () => {
  const payables = await listPayables()
  const total = payables.reduce((sum, p) => sum + p.balanceUsd, 0)
  const overdue = payables.filter((p) => (p.daysOverdue ?? 0) > 0)
  const overdueTotal = overdue.reduce((sum, p) => sum + p.balanceUsd, 0)
  const sorted = [...payables].sort((a, b) => (b.daysOverdue ?? -1) - (a.daysOverdue ?? -1))

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader help="payables" title="Por pagar" description="Lo que le debemos a los proveedores." />

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 tabular-nums">
          <div className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">Total por pagar</span>
            <span className="text-lg font-semibold">{formatMoney(total, "USD")}</span>
          </div>
          <div className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">Vencido ({overdue.length})</span>
            <span className="text-lg font-semibold">{formatMoney(overdueTotal, "USD")}</span>
          </div>
        </CardContent>
      </Card>

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No hay cuentas por pagar.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {sorted.map((p) => (
            <li key={p.purchaseId}>
              <Link
                href={ROUTES.PURCHASE(p.purchaseId)}
                className="flex items-start gap-3 p-3 transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{p.supplierName}</span>
                    {p.daysOverdue !== null && p.daysOverdue > 0 && (
                      <StatusBadge tone="error">
                        Vencida hace {p.daysOverdue} {p.daysOverdue === 1 ? "día" : "días"}
                      </StatusBadge>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatPurchaseNumber(p.number)} · {formatDate(p.occurredAt)}
                    {p.dueDate ? ` · vence ${formatDate(`${p.dueDate}T12:00:00-04:00`)}` : " · sin vencimiento"}
                  </span>
                </div>
                <div className="grid justify-items-end gap-0.5 tabular-nums">
                  <span className="font-medium">{formatMoney(p.balanceUsd, "USD")}</span>
                  <span className="text-xs text-muted-foreground">de {formatMoney(p.totalUsd, "USD")}</span>
                </div>
                <ChevronRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default PayablesScreen

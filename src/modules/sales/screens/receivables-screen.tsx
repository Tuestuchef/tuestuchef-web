import Link from "next/link"

import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { Card, CardContent } from "@/common/components/ui/card"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatDate } from "@/common/lib/utils/format-date.util"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import MessageActions from "@/modules/messages/components/message-actions"

import { formatSaleNumber } from "../lib/constants/sales.constants"
import { listReceivables } from "../lib/services/sales.service"

const usd = (value: number) => formatMoney(value, "USD")

// Cuentas por cobrar (owner y admin): calculadas desde las ventas, sin datos duplicados.
const ReceivablesScreen = async () => {
  const groups = await listReceivables()
  const total = groups.reduce((sum, g) => sum + g.balanceUsd, 0)
  const over30 = groups.flatMap((g) => g.sales).filter((s) => s.daysOutstanding > 30)

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader help="receivables" title="Por cobrar" description="Quién nos debe, cuánto y desde cuándo." />

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 tabular-nums">
          <div className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">Total por cobrar</span>
            <span className="text-lg font-semibold">{usd(total)}</span>
          </div>
          <div className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">Más de 30 días ({over30.length})</span>
            <span className="text-lg font-semibold">{usd(over30.reduce((sum, s) => sum + s.balanceUsd, 0))}</span>
          </div>
        </CardContent>
      </Card>

      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nadie nos debe.</p>
      ) : (
        <div className="grid gap-3">
          {groups.map((group) => (
            <section key={group.customerId ?? "none"} className="grid gap-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-start gap-2">
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-medium">
                    {group.customerId ? (
                      <Link href={ROUTES.CUSTOMER(group.customerId)} className="underline-offset-4 hover:underline">
                        {group.customerName ?? "Cliente"}
                      </Link>
                    ) : (
                      "Ventas rápidas (sin cliente)"
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {group.sales.length} {group.sales.length === 1 ? "venta" : "ventas"} · la más antigua hace {group.oldestDays}{" "}
                    {group.oldestDays === 1 ? "día" : "días"}
                  </span>
                </div>
                <span className="font-semibold tabular-nums">{usd(group.balanceUsd)}</span>
                {group.customerId && (
                  <MessageActions target={{ type: "customer", customerId: group.customerId }} kinds={["payment_reminder"]} size="sm" />
                )}
              </div>
              <ul className="divide-y border-t">
                {group.sales.map((sale) => (
                  <li key={sale.saleId}>
                    <Link
                      href={ROUTES.SALE(sale.saleId)}
                      className="flex items-center gap-2 py-2 text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="flex-1">
                        {formatSaleNumber(sale.number)} · {formatDate(sale.occurredAt)}
                        {sale.daysOutstanding > 30 && (
                          <StatusBadge tone="error" className="ml-2">
                            +30 días
                          </StatusBadge>
                        )}
                      </span>
                      <span className="tabular-nums">
                        {usd(sale.balanceUsd)} <span className="text-xs text-muted-foreground">de {usd(sale.totalUsd)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export default ReceivablesScreen

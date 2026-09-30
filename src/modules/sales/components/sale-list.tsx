import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"

import StatusBadge from "@/common/components/status-badge"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatDate, formatDayHeading, formatTime, toCaracasDate } from "@/common/lib/utils/format-date.util"
import { formatMoney } from "@/common/lib/utils/format-money.util"

import { CHANNEL_LABELS, formatSaleNumber } from "../lib/constants/sales.constants"
import type { SaleListItem } from "../lib/types/sales.types"
import PaymentStatusBadge from "./payment-status-badge"

type SaleListProps = {
  sales: SaleListItem[]
  emptyMessage?: string
  groupByDay?: boolean
}

const SaleRow = ({ sale }: { sale: SaleListItem }) => (
  <li>
    <Link
      href={ROUTES.SALE(sale.id)}
      className="flex items-start gap-3 p-3 transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{sale.customerName ?? "Venta rápida"}</span>
          <PaymentStatusBadge status={sale.paymentStatus} />
          {sale.pendingProduction && <StatusBadge tone="info">Por encargo</StatusBadge>}
          {sale.isBackdated && <StatusBadge tone="info">Retroactiva</StatusBadge>}
        </span>
        <span className="truncate text-sm text-muted-foreground">{sale.itemsSummary}</span>
        <span className="text-xs text-muted-foreground">
          {formatSaleNumber(sale.number)} · {CHANNEL_LABELS[sale.channel]} ·{" "}
          {sale.isBackdated ? `registrada el ${formatDate(sale.createdAt)}` : formatTime(sale.occurredAt)}
        </span>
      </div>
      <div className="grid justify-items-end gap-0.5 tabular-nums">
        <span className={sale.paymentStatus === "voided" ? "font-medium line-through" : "font-medium"}>
          {formatMoney(sale.totalUsd, "USD")}
        </span>
        {(sale.paymentStatus === "partial" || sale.paymentStatus === "pending") && (
          <span className="text-xs text-muted-foreground">Debe {formatMoney(sale.balanceUsd, "USD")}</span>
        )}
      </div>
      <ChevronRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  </li>
)

const SaleList = ({ sales, emptyMessage = "No hay ventas con estos filtros.", groupByDay = true }: SaleListProps) => {
  if (sales.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }

  if (!groupByDay) {
    return (
      <ul className="divide-y rounded-lg border">
        {sales.map((sale) => (
          <SaleRow key={sale.id} sale={sale} />
        ))}
      </ul>
    )
  }

  const days = new Map<string, SaleListItem[]>()
  for (const sale of sales) {
    const day = toCaracasDate(sale.occurredAt)
    days.set(day, [...(days.get(day) ?? []), sale])
  }

  return (
    <div className="grid gap-5">
      {[...days.entries()].map(([day, daySales]) => (
        <section key={day} className="grid gap-2">
          <h2 className="text-sm font-medium text-muted-foreground first-letter:uppercase">
            {formatDayHeading(`${day}T12:00:00-04:00`)}
          </h2>
          <ul className="divide-y rounded-lg border">
            {daySales.map((sale) => (
              <SaleRow key={sale.id} sale={sale} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export default SaleList

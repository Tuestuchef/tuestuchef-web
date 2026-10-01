import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"

import StatusBadge from "@/common/components/status-badge"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatDate } from "@/common/lib/utils/format-date.util"
import { formatMoney } from "@/common/lib/utils/format-money.util"

import { formatPurchaseNumber } from "../lib/constants/purchases.constants"
import type { PurchaseListItem } from "../lib/types/purchases.types"
import PurchaseStatusBadge from "./purchase-status-badge"

const PurchaseList = ({ purchases, today }: { purchases: PurchaseListItem[]; today: string }) => {
  if (purchases.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No hay compras con estos filtros.</p>
  }

  return (
    <ul className="divide-y rounded-lg border">
      {purchases.map((p) => {
        const open = p.status === "pending" || p.status === "partial"
        const overdue = open && p.dueDate !== null && p.dueDate < today
        return (
          <li key={p.id}>
            <Link
              href={ROUTES.PURCHASE(p.id)}
              className="flex items-start gap-3 p-3 transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{p.supplierName}</span>
                  <PurchaseStatusBadge status={p.status} overdue={overdue} />
                  {p.isBackdated && <StatusBadge tone="info">Retroactiva</StatusBadge>}
                </span>
                <span className="truncate text-sm text-muted-foreground">{p.itemsSummary}</span>
                <span className="text-xs text-muted-foreground">
                  {formatPurchaseNumber(p.number)} · {formatDate(p.occurredAt)}
                  {open && p.dueDate && ` · vence ${formatDate(`${p.dueDate}T12:00:00-04:00`)}`}
                </span>
              </div>
              <div className="grid justify-items-end gap-0.5 tabular-nums">
                <span className={p.status === "voided" ? "font-medium line-through" : "font-medium"}>
                  {formatMoney(p.totalUsd, "USD")}
                </span>
                {open && <span className="text-xs text-muted-foreground">Debemos {formatMoney(p.balanceUsd, "USD")}</span>}
              </div>
              <ChevronRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export default PurchaseList

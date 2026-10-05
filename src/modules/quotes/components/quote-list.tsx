import Link from "next/link"

import { ROUTES } from "@/common/lib/constants/routes.constants"
import { caracasNoonIso, formatDate } from "@/common/lib/utils/format-date.util"
import { formatMoney } from "@/common/lib/utils/format-money.util"

import type { QuoteListItem } from "../lib/types/quotes.types"
import QuoteStatusBadge from "./quote-status-badge"

const QuoteList = ({ quotes }: { quotes: QuoteListItem[] }) => {
  if (quotes.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No hay presupuestos con estos filtros.</p>
  return (
    <ul className="divide-y rounded-lg border">
      {quotes.map((q) => (
        <li key={q.id}>
          <Link
            href={ROUTES.QUOTE(q.id)}
            className="flex items-center gap-3 p-3 transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="grid min-w-0 flex-1 gap-0.5">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-sm font-medium">{q.code}</span>
                <QuoteStatusBadge status={q.effectiveStatus} />
                {q.orderSaleId && <span className="text-xs text-muted-foreground">· convertido en pedido</span>}
              </span>
              <span className="truncate text-sm">{q.customerName || "Sin cliente"}</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(caracasNoonIso(q.issuedOn))} · vence {formatDate(caracasNoonIso(q.validUntil))} · {q.createdByName}
              </span>
            </div>
            <div className="grid justify-items-end gap-0.5 text-right text-sm tabular-nums">
              {q.currencies !== "ves" && <span className="font-medium">{formatMoney(q.usdTotal, "USD")}</span>}
              {q.currencies !== "usd" && <span className={q.currencies === "both" ? "text-xs text-muted-foreground" : "font-medium"}>{formatMoney(q.vesTotalBs, "VES")}</span>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default QuoteList

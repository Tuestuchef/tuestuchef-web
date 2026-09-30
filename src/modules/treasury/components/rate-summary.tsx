import StatusBadge from "@/common/components/status-badge"
import { formatDate } from "@/common/lib/utils/format-date.util"
import { formatRate } from "@/common/lib/utils/format-money.util"
import { cn } from "@/common/lib/utils"

import type { ExchangeRate } from "../lib/types/treasury.types"

type RateSummaryProps = {
  rate: ExchangeRate | null
  hasTodayRate: boolean
  compact?: boolean
  className?: string
}

const RateSummary = ({ rate, hasTodayRate, compact, className }: RateSummaryProps) => {
  if (!rate) {
    return <StatusBadge tone="warning">Sin tasa registrada</StatusBadge>
  }

  const items = [
    { label: "USDT (paralelo)", value: formatRate(Number(rate.binance_usdt)) },
    { label: "BCV $", value: formatRate(Number(rate.bcv_usd)) },
    ...(compact ? [] : [{ label: "BCV €", value: formatRate(Number(rate.bcv_eur)) }]),
    ...(Number(rate.usd_usdt) !== 1 ? [{ label: "USD→USDT", value: formatRate(Number(rate.usd_usdt)) }] : []),
  ]

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm", className)}>
      {items.map((item) => (
        <span key={item.label} className="tabular-nums">
          <span className="text-muted-foreground">{item.label}</span> {item.value}
        </span>
      ))}
      {!compact && (
        <span className="text-xs text-muted-foreground">
          {rate.source === "api" ? "Automática (DolarAPI)" : "Manual"}
        </span>
      )}
      {hasTodayRate ? (
        !compact && <span className="text-xs text-muted-foreground">· de hoy</span>
      ) : (
        <StatusBadge tone="warning">Del {formatDate(rate.rate_date + "T12:00:00-04:00")}</StatusBadge>
      )}
    </div>
  )
}

export default RateSummary

import { PaperclipIcon } from "lucide-react"

import StatusBadge from "@/common/components/status-badge"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatDayHeading, formatTime, toCaracasDate } from "@/common/lib/utils/format-date.util"
import { formatMoney, formatUsdt } from "@/common/lib/utils/format-money.util"

import { ENTRY_TYPE_LABELS } from "../lib/constants/money-movements.constants"
import type { LedgerEntryItem } from "../lib/types/money-movements.types"
import ReverseEntryDialog from "./reverse-entry-dialog"

type LedgerEntryListProps = {
  entries: LedgerEntryItem[]
  canReverse: boolean
  showAuthor: boolean
}

const entryTitle = (entry: LedgerEntryItem) =>
  entry.category?.name ?? ENTRY_TYPE_LABELS[entry.entryType]

const LedgerEntryList = ({ entries, canReverse, showAuthor }: LedgerEntryListProps) => {
  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No hay movimientos con estos filtros.</p>
  }

  const days = new Map<string, LedgerEntryItem[]>()
  for (const entry of entries) {
    const day = toCaracasDate(entry.occurredAt)
    days.set(day, [...(days.get(day) ?? []), entry])
  }

  return (
    <div className="grid gap-5">
      {[...days.entries()].map(([day, dayEntries]) => (
        <section key={day} className="grid gap-2">
          <h2 className="text-sm font-medium text-muted-foreground first-letter:uppercase">
            {formatDayHeading(`${day}T12:00:00-04:00`)}
          </h2>
          <ul className="divide-y rounded-lg border">
            {dayEntries.map((entry) => {
              const isTransferRow = Boolean(entry.transferId)
              const summary = `${entryTitle(entry)} · ${formatMoney(entry.amount, entry.currency, { signed: true })}`
              return (
                <li key={entry.id} className="flex items-start gap-3 p-3">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{entryTitle(entry)}</span>
                      {entry.reversesEntryId && <StatusBadge tone="info">Reverso</StatusBadge>}
                      {entry.isReversed && <StatusBadge tone="warning">Revertido</StatusBadge>}
                    </div>
                    {entry.description && (
                      <span className="truncate text-sm text-muted-foreground">{entry.description}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {entry.accountName}
                      {entry.personName ? ` · ${entry.personName}` : ""}
                      {showAuthor && entry.authorName ? ` · por ${entry.authorName}` : ""}
                      {` · ${formatTime(entry.occurredAt)}`}
                    </span>
                  </div>
                  <div className="grid shrink-0 text-right tabular-nums">
                    <span className="font-semibold">
                      {formatMoney(entry.amount, entry.currency, { signed: true })}
                    </span>
                    {entry.currency !== "USDT" && (
                      <span className="text-xs text-muted-foreground">{formatUsdt(entry.usdtValue, { signed: true })}</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center">
                    {entry.hasReceipt && (
                      <a
                        href={ROUTES.RECEIPT(entry.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent"
                        aria-label="Ver comprobante"
                      >
                        <PaperclipIcon className="size-4" />
                      </a>
                    )}
                    {canReverse && !isTransferRow && !entry.reversesEntryId && !entry.isReversed && (
                      <ReverseEntryDialog entryId={entry.id} summary={summary} />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

export default LedgerEntryList

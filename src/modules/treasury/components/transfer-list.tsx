import StatusBadge from "@/common/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/common/components/ui/card"
import { formatDate } from "@/common/lib/utils/format-date.util"
import { formatMoney } from "@/common/lib/utils/format-money.util"

import type { TransferSummary } from "../lib/types/treasury.types"
import ReverseTransferDialog from "./reverse-transfer-dialog"

const TransferList = ({ transfers }: { transfers: TransferSummary[] }) => (
  <Card>
    <CardHeader>
      <CardTitle>Traspasos recientes</CardTitle>
    </CardHeader>
    <CardContent>
      {transfers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay traspasos.</p>
      ) : (
        <ul className="grid gap-2">
          {transfers.map((transfer) => {
            const summary = `${transfer.from.name} → ${transfer.to.name}`
            return (
              <li key={transfer.id} className="grid gap-2 rounded-lg border p-3 sm:flex sm:items-center">
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate font-medium">{summary}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(transfer.occurredAt)}
                    {transfer.note ? ` · ${transfer.note}` : ""}
                  </span>
                </div>
                <div className="grid text-sm tabular-nums sm:text-right">
                  <span>
                    {formatMoney(transfer.amountOut, transfer.from.currency)} →{" "}
                    {formatMoney(transfer.amountIn, transfer.to.currency)}
                  </span>
                  {transfer.feeAmount !== 0 && (
                    <span className="text-xs text-muted-foreground">
                      {transfer.feeAmount < 0 ? "Comisión" : "Ganancia"}{" "}
                      {formatMoney(Math.abs(transfer.feeAmount), transfer.from.currency)}
                    </span>
                  )}
                </div>
                {transfer.isVoided ? (
                  <StatusBadge tone="info">Anulado</StatusBadge>
                ) : (
                  <ReverseTransferDialog transferId={transfer.id} description={summary} />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </CardContent>
  </Card>
)

export default TransferList

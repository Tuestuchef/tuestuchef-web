import { FileSpreadsheetIcon } from "lucide-react"

import PageHeader from "@/common/components/page-header"
import SignedAmount from "@/common/components/signed-amount"
import StatusBadge from "@/common/components/status-badge"
import { Button } from "@/common/components/ui/button"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatDate } from "@/common/lib/utils/format-date.util"

import { ClosePeriodButton, ReopenPeriodDialog } from "../components/period-actions"
import { listPeriods } from "../lib/services/period-close.service"

const monthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number)
  const label = new Intl.DateTimeFormat("es-VE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// Cierres de mes y exportación a Excel para el contador (owner y admin).
const PeriodsScreen = async ({ isOwner }: { isOwner: boolean }) => {
  const periods = await listPeriods()

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader
        help="periods"
        title="Cierres y exportación"
        description="Descarga el Excel del mes para el contador y cierra los meses terminados."
      />
      <ul className="divide-y rounded-xl border">
        {periods.map((p) => {
          const label = monthLabel(p.month)
          return (
            <li key={p.month} className="flex flex-wrap items-center gap-3 p-3">
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  {label}
                  {p.isCurrent ? (
                    <StatusBadge tone="info">En curso</StatusBadge>
                  ) : p.isClosed ? (
                    <StatusBadge tone="success">Cerrado</StatusBadge>
                  ) : (
                    <StatusBadge tone="warning">Abierto</StatusBadge>
                  )}
                </span>
                {p.isClosed && p.changedAt && (
                  <span className="text-xs text-muted-foreground">
                    Cerrado el {formatDate(p.changedAt)}
                    {p.changedByName ? ` por ${p.changedByName}` : ""}
                  </span>
                )}
                {p.reopenReason && <span className="text-xs text-muted-foreground">Reabierto: {p.reopenReason}</span>}
              </div>
              {p.profitUsdt !== null && (
                <span className="text-sm">
                  Utilidad <SignedAmount value={p.profitUsdt} />
                </span>
              )}
              <div className="flex flex-wrap gap-1">
                <Button asChild variant="outline" size="sm">
                  <a href={ROUTES.PERIOD_EXPORT(p.month)} download>
                    <FileSpreadsheetIcon aria-hidden />
                    Excel
                  </a>
                </Button>
                {!p.isCurrent && !p.isClosed && <ClosePeriodButton month={p.month} label={label} />}
                {p.isClosed && isOwner && <ReopenPeriodDialog month={p.month} label={label} />}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        El Excel trae el resumen de utilidad real, ventas, pagos recibidos, compras, movimientos de dinero y sueldos del mes,
        con sus montos en su moneda y en valor real (USDT).
      </p>
    </div>
  )
}

export default PeriodsScreen

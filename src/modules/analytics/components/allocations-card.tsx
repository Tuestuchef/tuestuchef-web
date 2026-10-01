import StatusBadge from "@/common/components/status-badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import { formatUsdt } from "@/common/lib/utils/format-money.util"

import type { ProfitPolicy, ReserveActivity } from "../lib/types/analytics.types"
import ProfitPolicyDialog from "./profit-policy-dialog"

type AllocationsCardProps = {
  profit: number
  reinvestmentSpent: number
  policy: ProfitPolicy
  reserve: ReserveActivity | null
  usdtAccounts: { id: string; name: string }[]
}

// Plan (política × utilidad) frente a lo real (transferido / gastado). Sin color: icono y texto.
const Row = ({ label, planned, actual, actualLabel }: { label: string; planned: number; actual: number; actualLabel: string }) => {
  const diff = actual - planned
  const done = planned <= 0 || diff >= -0.01
  return (
    <div className="grid gap-1.5 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{label}</span>
        <StatusBadge tone={done ? "success" : "warning"}>{done ? "Al día" : `Faltan ${formatUsdt(-diff)}`}</StatusBadge>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm tabular-nums">
        <div>
          <dt className="text-xs text-muted-foreground">Según la política</dt>
          <dd>{formatUsdt(planned)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{actualLabel}</dt>
          <dd>{formatUsdt(actual)}</dd>
        </div>
      </dl>
    </div>
  )
}

const AllocationsCard = ({ profit, reinvestmentSpent, policy, reserve, usdtAccounts }: AllocationsCardProps) => {
  // Con utilidad negativa no hay nada que apartar.
  const base = Math.max(profit, 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Asignaciones de la utilidad</CardTitle>
        <CardDescription>
          Reserva {policy.reservePercent}% · reinversión {policy.reinvestmentPercent}%. Salen de la utilidad: no se restan antes.
        </CardDescription>
        <CardAction>
          <ProfitPolicyDialog policy={policy} usdtAccounts={usdtAccounts} />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        {profit <= 0 && (
          <p className="text-sm text-muted-foreground">Sin utilidad en el período: no hay nada que apartar según la política.</p>
        )}
        {policy.reserveAccountId && reserve ? (
          <Row
            label={`Reserva · ${reserve.accountName}`}
            planned={(base * policy.reservePercent) / 100}
            actual={reserve.transferredUsdt}
            actualLabel={`Transferido (saldo ${formatUsdt(reserve.balanceUsdt)})`}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Sin cuenta de reserva. Elígela en Política.</p>
        )}
        <Row
          label="Reinversión"
          planned={(base * policy.reinvestmentPercent) / 100}
          actual={reinvestmentSpent}
          actualLabel="Gastado (categoría reinversión)"
        />
      </CardContent>
    </Card>
  )
}

export default AllocationsCard

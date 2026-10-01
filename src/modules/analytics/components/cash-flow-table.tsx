import StatusBadge from "@/common/components/status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import { formatMoney, formatUsdt } from "@/common/lib/utils/format-money.util"

import type { CashFlowRow } from "../lib/types/analytics.types"

// Flujo de caja por cuenta: cuánto había, cuánto entró y salió, y cuánto queda.
// Montos en la moneda de cada cuenta; el total del período, en valor real (USDT).
const CashFlowTable = ({ rows }: { rows: CashFlowRow[] }) => {
  const visible = rows.filter((r) => r.isActive || r.inflows || r.outflows || r.closing)
  const inUsdt = visible.reduce((sum, r) => sum + r.inflowsUsdt, 0)
  const outUsdt = visible.reduce((sum, r) => sum + r.outflowsUsdt, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flujo de caja por cuenta</CardTitle>
        <CardDescription>
          En el período entraron {formatUsdt(inUsdt)} y salieron {formatUsdt(outUsdt)} en valor real. Incluye traspasos
          entre cuentas.
        </CardDescription>
      </CardHeader>
      <CardContent className="-mx-2 overflow-x-auto px-2">
        <table className="w-full min-w-[36rem] text-sm tabular-nums">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 font-medium">Cuenta</th>
              <th className="py-2 text-right font-medium">Al inicio</th>
              <th className="py-2 text-right font-medium">Entró</th>
              <th className="py-2 text-right font-medium">Salió</th>
              <th className="py-2 text-right font-medium">Al final</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.accountId} className="border-b last:border-0">
                <td className="py-2">
                  {r.name} <span className="text-xs text-muted-foreground">{r.currency}</span>
                  {!r.isActive && <StatusBadge tone="info" className="ml-1">Inactiva</StatusBadge>}
                </td>
                <td className="py-2 text-right">{formatMoney(r.opening, r.currency)}</td>
                <td className="py-2 text-right">
                  +{formatMoney(r.inflows, r.currency)}
                  <span className="block text-xs text-muted-foreground">{formatUsdt(r.inflowsUsdt)}</span>
                </td>
                <td className="py-2 text-right">
                  −{formatMoney(r.outflows, r.currency)}
                  <span className="block text-xs text-muted-foreground">{formatUsdt(r.outflowsUsdt)}</span>
                </td>
                <td className="py-2 text-right font-medium">{formatMoney(r.closing, r.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

export default CashFlowTable

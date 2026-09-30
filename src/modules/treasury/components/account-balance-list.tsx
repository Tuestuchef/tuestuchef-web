import StatusBadge from "@/common/components/status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import { formatMoney, formatUsdt } from "@/common/lib/utils/format-money.util"
import { toUsdt } from "@/common/lib/utils/to-usdt.util"

import { ACCOUNT_KIND_LABELS } from "../lib/constants/treasury.constants"
import type { AccountBalance, ExchangeRate } from "../lib/types/treasury.types"

type AccountBalanceListProps = {
  balances: AccountBalance[]
  rate: ExchangeRate | null
}

// Saldo en su moneda y su valor hoy en USDT (a la tasa vigente, solo referencia).
const AccountBalanceList = ({ balances, rate }: AccountBalanceListProps) => {
  const rates = rate
    ? { binanceRate: Number(rate.binance_usdt), usdUsdtRate: Number(rate.usd_usdt) }
    : null
  const valueToday = (balance: AccountBalance) => (rates ? toUsdt(balance.balance, balance.currency, rates) : null)
  const total = rates
    ? balances.filter((b) => b.isActive).reduce((sum, b) => sum + (valueToday(b) ?? 0), 0)
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saldos</CardTitle>
        <CardDescription>
          Calculados desde el libro. El valor en USDT usa la tasa vigente.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {balances.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no hay cuentas. Créalas en Configuración → Cuentas.</p>
        )}
        <ul className="grid gap-2">
          {balances.map((balance) => (
            <li key={balance.accountId} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="grid min-w-0 flex-1">
                <span className="truncate font-medium">{balance.name}</span>
                <span className="text-xs text-muted-foreground">
                  {ACCOUNT_KIND_LABELS[balance.kind]} · {balance.entriesCount} movimientos
                </span>
              </div>
              {!balance.isActive && <StatusBadge tone="info">Inactiva</StatusBadge>}
              <div className="grid text-right tabular-nums">
                <span className="font-semibold">{formatMoney(balance.balance, balance.currency)}</span>
                {balance.currency !== "USDT" && valueToday(balance) !== null && (
                  <span className="text-xs text-muted-foreground">≈ {formatUsdt(valueToday(balance)!)}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
        {total !== null && balances.length > 0 && (
          <div className="flex items-center justify-between border-t pt-3 font-semibold tabular-nums">
            <span>Total activo</span>
            <span>≈ {formatUsdt(total)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default AccountBalanceList

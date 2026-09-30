import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { Card, CardContent } from "@/common/components/ui/card"
import { CURRENCY_LABELS } from "@/common/lib/constants/currency.constants"

import AccountFormDialog from "../components/account-form-dialog"
import { ACCOUNT_KIND_LABELS } from "../lib/constants/treasury.constants"
import { listAccounts } from "../lib/services/accounts.service"

const AccountsScreen = async () => {
  const accounts = await listAccounts()

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader
        help="accounts"
        title="Cuentas"
        description="Bs, USDT, dólares en efectivo y Zelle. El saldo se calcula desde los movimientos."
        actions={<AccountFormDialog />}
      />
      <Card>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Crea la primera cuenta para empezar a registrar movimientos.</p>
          ) : (
            <ul className="divide-y">
              {accounts.map((account) => (
                <li key={account.id} className="flex items-center gap-3 py-3">
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate font-medium">{account.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {ACCOUNT_KIND_LABELS[account.kind]} · {CURRENCY_LABELS[account.currency]}
                      {account.notes ? ` · ${account.notes}` : ""}
                    </span>
                  </div>
                  {!account.is_active && <StatusBadge tone="info">Inactiva</StatusBadge>}
                  <AccountFormDialog account={account} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default AccountsScreen

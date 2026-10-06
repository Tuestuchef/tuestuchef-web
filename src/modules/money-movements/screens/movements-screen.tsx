import { PlusIcon } from "lucide-react"
import Link from "next/link"

import SignedAmount from "@/common/components/signed-amount"
import PageHeader from "@/common/components/page-header"
import { Button } from "@/common/components/ui/button"
import { Card, CardContent } from "@/common/components/ui/card"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import type { SessionUser } from "@/common/lib/types/session.types"
import { listAccounts } from "@/modules/treasury/lib/services/accounts.service"

import LedgerEntryList from "../components/ledger-entry-list"
import MovementFilters from "../components/movement-filters"
import { listEntries } from "../lib/services/ledger.service"
import type { MovementFilters as Filters } from "../lib/types/money-movements.types"
import { summarizeEntries } from "../lib/utils/summarize-entries.util"

type MovementsScreenProps = {
  user: SessionUser
  filters: Filters
}

const MovementsScreen = async ({ user, filters }: MovementsScreenProps) => {
  const isManagement = isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)
  const [entries, accounts] = await Promise.all([listEntries(filters), listAccounts()])
  const totals = summarizeEntries(entries)

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader
        help="movements"
        title="Movimientos"
        description={isManagement ? "Libro de ingresos, gastos y traspasos." : "Los movimientos que registraste."}
        actions={
          <Button asChild className="h-11 md:h-9">
            <Link href={ROUTES.NEW_MOVEMENT}>
              <PlusIcon aria-hidden />
              Nuevo
            </Link>
          </Button>
        }
      />

      <MovementFilters filters={filters} accounts={accounts} />

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 tabular-nums">
          <div className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">Ingresos del período</span>
            <SignedAmount value={totals.incomeUsdt} tone="income" className="text-lg font-semibold" />
          </div>
          <div className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">Egresos del período</span>
            <SignedAmount value={totals.expenseUsdt} tone="expense" className="text-lg font-semibold" />
          </div>
        </CardContent>
      </Card>

      <LedgerEntryList entries={entries} canReverse={isManagement} showAuthor={isManagement} />
    </div>
  )
}

export default MovementsScreen

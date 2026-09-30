import Link from "next/link"

import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { isStorageEnabled } from "@/common/lib/services/storage.service"
import type { SessionUser } from "@/common/lib/types/session.types"
import RateSummary from "@/modules/treasury/components/rate-summary"
import TodayRateBanner from "@/modules/treasury/components/today-rate-banner"
import { listAccounts } from "@/modules/treasury/lib/services/accounts.service"
import { getRateStatus } from "@/modules/treasury/lib/services/exchange-rates.service"

import LedgerEntryForm from "../components/ledger-entry-form"
import { getLastUsedAccountId, listPeople } from "../lib/services/ledger.service"
import { listCategoryOptions } from "../lib/services/movement-categories.service"

type NewMovementScreenProps = {
  user: SessionUser
}

const NewMovementScreen = async ({ user }: NewMovementScreenProps) => {
  const isManagement = isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)
  const [accounts, categories, rateStatus, lastAccountId, people] = await Promise.all([
    listAccounts({ activeOnly: true }),
    listCategoryOptions(),
    getRateStatus(),
    getLastUsedAccountId(user.id),
    isManagement ? listPeople() : Promise.resolve([]),
  ])

  const rates = rateStatus.rate
    ? {
        binanceRate: Number(rateStatus.rate.binance_usdt),
        usdUsdtRate: Number(rateStatus.rate.usd_usdt),
      }
    : null

  return (
    <div className="mx-auto grid w-full max-w-xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo movimiento</h1>
        <Link href={ROUTES.MOVEMENTS} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Ver movimientos
        </Link>
      </div>

      {rateStatus.hasTodayRate ? (
        <RateSummary rate={rateStatus.rate} hasTodayRate compact className="text-muted-foreground" />
      ) : (
        <TodayRateBanner />
      )}

      <LedgerEntryForm
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
        categories={categories}
        people={people}
        defaultAccountId={lastAccountId}
        rates={rates}
        receiptsEnabled={isStorageEnabled()}
      />
    </div>
  )
}

export default NewMovementScreen

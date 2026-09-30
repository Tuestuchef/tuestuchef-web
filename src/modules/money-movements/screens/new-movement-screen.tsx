import Link from "next/link"

import PageHelp from "@/common/components/page-help"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { isStorageEnabled } from "@/common/lib/services/storage.service"
import type { SessionUser } from "@/common/lib/types/session.types"
import { getSalesSettings } from "@/modules/sales/lib/services/sales.service"
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

// Staff: fecha más antigua que puede usar (misma regla que la base).
const daysBefore = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

const NewMovementScreen = async ({ user }: NewMovementScreenProps) => {
  const isManagement = isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)
  const [accounts, categories, rateStatus, lastAccountId, people, settings] = await Promise.all([
    listAccounts({ activeOnly: true }),
    listCategoryOptions(),
    getRateStatus(),
    getLastUsedAccountId(user.id),
    isManagement ? listPeople() : Promise.resolve([]),
    isManagement ? Promise.resolve(null) : getSalesSettings(),
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
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Nuevo movimiento</h1>
          <PageHelp topic="newMovement" />
        </div>
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
        minDate={settings && rateStatus.today ? daysBefore(rateStatus.today, settings.staffMaxBackdateDays) : undefined}
      />
    </div>
  )
}

export default NewMovementScreen

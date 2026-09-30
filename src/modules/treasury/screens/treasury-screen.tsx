import { ArrowLeftRightIcon } from "lucide-react"
import Link from "next/link"

import PageHeader from "@/common/components/page-header"
import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/common/components/ui/card"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import AccountBalanceList from "../components/account-balance-list"
import ExchangeRateDialog from "../components/exchange-rate-dialog"
import RateSummary from "../components/rate-summary"
import SyncRatesButton from "../components/sync-rates-button"
import TransferList from "../components/transfer-list"
import { listAccountBalances } from "../lib/services/accounts.service"
import { getRateStatus } from "../lib/services/exchange-rates.service"
import { listRecentTransfers } from "../lib/services/transfers.service"

type TreasuryScreenProps = {
  transferSaved?: boolean
}

const TreasuryScreen = async ({ transferSaved }: TreasuryScreenProps) => {
  const [rateStatus, balances, transfers] = await Promise.all([
    getRateStatus(),
    listAccountBalances(),
    listRecentTransfers(),
  ])

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4">
      <PageHeader
        title="Tasas y cuentas"
        actions={
          <Button asChild className="h-11 md:h-9">
            <Link href={ROUTES.NEW_TRANSFER}>
              <ArrowLeftRightIcon aria-hidden />
              Nuevo traspaso
            </Link>
          </Button>
        }
      />

      {transferSaved && (
        <StatusAlert tone="success" title="Traspaso registrado." />
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>Tasa vigente</CardTitle>
            <p className="text-sm text-muted-foreground">
              Se actualiza sola cada mañana (6:00) desde el BCV.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SyncRatesButton />
            <ExchangeRateDialog
              label={
                rateStatus.hasTodayRate
                  ? "Corregir tasa"
                  : "Registrar tasa manual"
              }
              defaults={
                rateStatus.rate
                  ? {
                      bcv_usd: Number(rateStatus.rate.bcv_usd),
                      bcv_eur: Number(rateStatus.rate.bcv_eur),
                      binance_usdt: Number(rateStatus.rate.binance_usdt),
                    }
                  : undefined
              }
            />
          </div>
        </CardHeader>
        <CardContent>
          <RateSummary
            rate={rateStatus.rate}
            hasTodayRate={rateStatus.hasTodayRate}
          />
        </CardContent>
      </Card>

      <AccountBalanceList balances={balances} rate={rateStatus.rate} />
      <TransferList transfers={transfers} />
    </div>
  )
}

export default TreasuryScreen

import PageHeader from "@/common/components/page-header"
import { Card, CardContent } from "@/common/components/ui/card"
import { isStorageEnabled } from "@/common/lib/services/storage.service"

import TodayRateBanner from "../components/today-rate-banner"
import TransferForm from "../components/transfer-form"
import { listAccounts } from "../lib/services/accounts.service"
import { getRateStatus } from "../lib/services/exchange-rates.service"

const TransferScreen = async () => {
  const [accounts, rateStatus] = await Promise.all([listAccounts({ activeOnly: true }), getRateStatus()])

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader
        title="Nuevo traspaso"
        description="Mover dinero entre cuentas o cambiar de moneda. La comisión se registra aparte."
      />
      {!rateStatus.hasTodayRate && <TodayRateBanner />}
      {rateStatus.rate && (
        <Card>
          <CardContent>
            <TransferForm accounts={accounts} rate={rateStatus.rate} receiptsEnabled={isStorageEnabled()} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default TransferScreen

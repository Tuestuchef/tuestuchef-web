import PageHeader from "@/common/components/page-header"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { isStorageEnabled } from "@/common/lib/services/storage.service"
import type { SessionUser } from "@/common/lib/types/session.types"
import TodayRateBanner from "@/modules/treasury/components/today-rate-banner"

import PurchaseForm from "../components/purchase-form"
import { getPurchaseFormData } from "../lib/services/purchases.service"

const NewPurchaseScreen = async ({ user }: { user: SessionUser }) => {
  const data = await getPurchaseFormData()

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader help="newPurchase" title="Nueva compra" />
      {!data.rates?.isCurrent && <TodayRateBanner />}
      <PurchaseForm {...data} canManage={isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)} receiptsEnabled={isStorageEnabled()} />
    </div>
  )
}

export default NewPurchaseScreen

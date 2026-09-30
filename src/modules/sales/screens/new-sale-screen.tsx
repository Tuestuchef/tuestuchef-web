import PageHeader from "@/common/components/page-header"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import type { SessionUser } from "@/common/lib/types/session.types"
import TodayRateBanner from "@/modules/treasury/components/today-rate-banner"

import SaleForm from "../components/sale-form"
import { getSaleFormData } from "../lib/services/sales.service"

const NewSaleScreen = async ({ user }: { user: SessionUser }) => {
  const data = await getSaleFormData()

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader title="Nueva venta" />
      {!data.rates?.isCurrent && <TodayRateBanner />}
      <SaleForm {...data} canManage={isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)} />
    </div>
  )
}

export default NewSaleScreen

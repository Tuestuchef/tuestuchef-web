import PageHeader from "@/common/components/page-header"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { isStorageEnabled } from "@/common/lib/services/storage.service"
import type { SessionUser } from "@/common/lib/types/session.types"
import { getCustomizationOptions } from "@/modules/orders/lib/services/order-settings.service"
import TodayRateBanner from "@/modules/treasury/components/today-rate-banner"

import SaleForm from "../components/sale-form"
import { getSaleFormData } from "../lib/services/sales.service"

const NewSaleScreen = async ({ user }: { user: SessionUser }) => {
  const [data, customization] = await Promise.all([getSaleFormData(), getCustomizationOptions()])

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader help="newSale" title="Nueva venta" />
      {!data.rates?.isCurrent && <TodayRateBanner />}
      <SaleForm
        {...data}
        {...customization}
        storageEnabled={isStorageEnabled()}
        canManage={isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)}
      />
    </div>
  )
}

export default NewSaleScreen

import MobileFormSheet from "@/common/components/mobile-form-sheet"
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
    // En el celular ocupa toda la pantalla, como una app (con su X para cerrar).
    <MobileFormSheet title="Nueva venta" help="newSale" discardLabel="la venta">
      {!data.rates?.isCurrent && <TodayRateBanner />}
      <SaleForm
        {...data}
        {...customization}
        storageEnabled={isStorageEnabled()}
        canManage={isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)}
      />
    </MobileFormSheet>
  )
}

export default NewSaleScreen

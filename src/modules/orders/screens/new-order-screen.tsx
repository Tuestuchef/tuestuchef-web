import MobileFormSheet from "@/common/components/mobile-form-sheet"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { isStorageEnabled } from "@/common/lib/services/storage.service"
import type { SessionUser } from "@/common/lib/types/session.types"

import OrderForm from "../components/order-form"
import { getOrderFormData } from "../lib/services/orders.service"

const NewOrderScreen = async ({ user }: { user: SessionUser }) => {
  const data = await getOrderFormData()
  return (
    // En el celular ocupa toda la pantalla, como una app (con su X para cerrar).
    <MobileFormSheet title="Nuevo pedido" help="newOrder" description="Cliente, productos, personalización, fecha y abono." discardLabel="el pedido">
      <OrderForm {...data} canManage={isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)} storageEnabled={isStorageEnabled()} />
    </MobileFormSheet>
  )
}

export default NewOrderScreen

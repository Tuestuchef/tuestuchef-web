import PageHeader from "@/common/components/page-header"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { isStorageEnabled } from "@/common/lib/services/storage.service"
import type { SessionUser } from "@/common/lib/types/session.types"

import OrderForm from "../components/order-form"
import { getOrderFormData } from "../lib/services/orders.service"

const NewOrderScreen = async ({ user }: { user: SessionUser }) => {
  const data = await getOrderFormData()
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader help="newOrder" title="Nuevo pedido" description="Cliente, productos, personalización, fecha y abono." />
      <OrderForm {...data} canManage={isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)} storageEnabled={isStorageEnabled()} />
    </div>
  )
}

export default NewOrderScreen

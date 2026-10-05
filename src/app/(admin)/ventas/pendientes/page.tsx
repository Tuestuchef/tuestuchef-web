import type { Metadata } from "next"

import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireSessionUser } from "@/common/lib/services/session.service"
import OfflineSalesScreen from "@/modules/sales/screens/offline-sales-screen"

export const metadata: Metadata = { title: "Ventas pendientes" }

export default async function OfflineSalesPage() {
  const user = await requireSessionUser()
  return <OfflineSalesScreen canManage={isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)} />
}

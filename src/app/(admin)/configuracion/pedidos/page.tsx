import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import OrderSettingsScreen from "@/modules/orders/screens/order-settings-screen"

export const metadata: Metadata = { title: "Pedidos y personalización" }

export default async function OrderSettingsPage() {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <OrderSettingsScreen />
}

import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import SalesSettingsScreen from "@/modules/sales/screens/sales-settings-screen"

export const metadata: Metadata = { title: "Configuración de ventas" }

export default async function SalesSettingsPage() {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <SalesSettingsScreen />
}

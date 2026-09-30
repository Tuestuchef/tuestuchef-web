import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import InitialStockScreen from "@/modules/products/screens/initial-stock-screen"

export const metadata: Metadata = { title: "Carga inicial de stock" }

export default async function InitialStockPage() {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <InitialStockScreen />
}

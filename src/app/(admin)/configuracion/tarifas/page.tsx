import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import PieceRatesScreen from "@/modules/orders/screens/piece-rates-screen"

export const metadata: Metadata = { title: "Tarifas a destajo" }

export default async function PieceRatesPage() {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <PieceRatesScreen />
}

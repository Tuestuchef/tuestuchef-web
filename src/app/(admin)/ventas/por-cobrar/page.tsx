import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import ReceivablesScreen from "@/modules/sales/screens/receivables-screen"

export const metadata: Metadata = { title: "Por cobrar" }

export default async function ReceivablesPage() {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <ReceivablesScreen />
}

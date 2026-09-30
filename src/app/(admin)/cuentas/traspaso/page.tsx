import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import TransferScreen from "@/modules/treasury/screens/transfer-screen"

export const metadata: Metadata = { title: "Nuevo traspaso" }

export default async function TransferPage() {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <TransferScreen />
}

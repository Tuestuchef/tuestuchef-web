import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import PayablesScreen from "@/modules/purchases/screens/payables-screen"

export const metadata: Metadata = { title: "Por pagar" }

export default async function PayablesPage() {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <PayablesScreen />
}

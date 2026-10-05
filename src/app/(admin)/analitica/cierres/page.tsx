import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import PeriodsScreen from "@/modules/analytics/screens/periods-screen"

export const metadata: Metadata = { title: "Cierres y exportación" }

export default async function PeriodsPage() {
  const user = await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <PeriodsScreen isOwner={user.role === "owner"} />
}

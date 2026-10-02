import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import ManualScreen from "@/modules/manual/screens/manual-screen"

export const metadata: Metadata = { title: "Manual" }

export default async function ManualPage() {
  const user = await requireRole(ROLE_GROUPS.ALL)
  return <ManualScreen role={user.role} />
}

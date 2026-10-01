import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import TeamScreen from "@/modules/team/screens/team-screen"

export const metadata: Metadata = { title: "Equipo" }

export default async function TeamPage() {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <TeamScreen />
}

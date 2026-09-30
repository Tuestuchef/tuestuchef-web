import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import UsersScreen from "@/modules/auth/screens/users-screen"

export const metadata: Metadata = { title: "Usuarios" }

export default async function UsersPage() {
  const user = await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <UsersScreen user={user} />
}

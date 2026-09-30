import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import AccountsScreen from "@/modules/treasury/screens/accounts-screen"

export const metadata: Metadata = { title: "Cuentas" }

export default async function AccountsPage() {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <AccountsScreen />
}

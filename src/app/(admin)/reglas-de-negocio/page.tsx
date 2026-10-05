import type { Metadata } from "next"

import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireSessionUser } from "@/common/lib/services/session.service"
import BusinessRulesScreen from "@/modules/orders/screens/business-rules-screen"

export const metadata: Metadata = { title: "Reglas del negocio" }

export default async function BusinessRulesPage() {
  const user = await requireSessionUser()
  return <BusinessRulesScreen canManage={isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)} />
}

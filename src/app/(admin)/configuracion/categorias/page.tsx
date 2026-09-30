import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import CategoriesScreen from "@/modules/money-movements/screens/categories-screen"

export const metadata: Metadata = { title: "Categorías" }

export default async function CategoriesPage() {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <CategoriesScreen />
}

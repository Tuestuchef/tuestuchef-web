import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import BusinessProfileScreen from "@/modules/business/screens/business-profile-screen"

export const metadata: Metadata = { title: "Datos de la empresa" }

export default async function BusinessProfilePage() {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <BusinessProfileScreen />
}

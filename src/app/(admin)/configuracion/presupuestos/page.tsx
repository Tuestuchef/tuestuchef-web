import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import QuoteSettingsScreen from "@/modules/quotes/screens/quote-settings-screen"

export const metadata: Metadata = { title: "Configuración de presupuestos" }

export default async function QuoteSettingsPage() {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <QuoteSettingsScreen />
}

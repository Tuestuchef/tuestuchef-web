import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import NotificationSettingsScreen from "@/modules/notifications/screens/notification-settings-screen"

export const metadata: Metadata = { title: "Avisos" }

export default async function NotificationSettingsPage() {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <NotificationSettingsScreen />
}

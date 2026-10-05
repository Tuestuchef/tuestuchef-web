import type { Metadata } from "next"

import { requireSessionUser } from "@/common/lib/services/session.service"
import MyNotificationsScreen from "@/modules/notifications/screens/my-notifications-screen"

export const metadata: Metadata = { title: "Mis avisos" }

export default async function MyNotificationsPage() {
  const user = await requireSessionUser()
  return <MyNotificationsScreen user={user} />
}

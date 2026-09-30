import type { Metadata } from "next"

import { requireSessionUser } from "@/common/lib/services/session.service"
import NewMovementScreen from "@/modules/money-movements/screens/new-movement-screen"

export const metadata: Metadata = { title: "Nuevo movimiento" }

export default async function NewMovementPage() {
  const user = await requireSessionUser()
  return <NewMovementScreen user={user} />
}

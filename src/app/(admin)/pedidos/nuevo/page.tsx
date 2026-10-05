import type { Metadata } from "next"

import { requireSessionUser } from "@/common/lib/services/session.service"
import NewOrderScreen from "@/modules/orders/screens/new-order-screen"

export const metadata: Metadata = { title: "Nuevo pedido" }

export default async function NewOrderPage() {
  const user = await requireSessionUser()
  return <NewOrderScreen user={user} />
}

import type { Metadata } from "next"

import { requireSessionUser } from "@/common/lib/services/session.service"
import NewSaleScreen from "@/modules/sales/screens/new-sale-screen"

export const metadata: Metadata = { title: "Nueva venta" }

export default async function NewSalePage() {
  const user = await requireSessionUser()
  return <NewSaleScreen user={user} />
}

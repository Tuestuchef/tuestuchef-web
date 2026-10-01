import type { Metadata } from "next"

import { requireSessionUser } from "@/common/lib/services/session.service"
import NewPurchaseScreen from "@/modules/purchases/screens/new-purchase-screen"

export const metadata: Metadata = { title: "Nueva compra" }

export default async function NewPurchasePage() {
  const user = await requireSessionUser()
  return <NewPurchaseScreen user={user} />
}

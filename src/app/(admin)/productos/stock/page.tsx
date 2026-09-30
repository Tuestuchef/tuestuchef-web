import type { Metadata } from "next"

import { requireSessionUser } from "@/common/lib/services/session.service"
import StockScreen from "@/modules/products/screens/stock-screen"

export const metadata: Metadata = { title: "Stock" }

export default async function StockPage() {
  const user = await requireSessionUser()
  return <StockScreen user={user} />
}

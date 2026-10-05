import type { Metadata } from "next"

import { requireSessionUser } from "@/common/lib/services/session.service"
import ProductionBoardScreen from "@/modules/orders/screens/production-board-screen"

export const metadata: Metadata = { title: "Tablero de producción" }

export default async function ProductionPage() {
  await requireSessionUser()
  return <ProductionBoardScreen />
}

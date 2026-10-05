import type { Metadata } from "next"

import { requireSessionUser } from "@/common/lib/services/session.service"
import ProductionAssignmentsScreen from "@/modules/orders/screens/production-assignments-screen"

export const metadata: Metadata = { title: "Quién tiene qué" }

export default async function ProductionAssignmentsPage() {
  await requireSessionUser()
  return <ProductionAssignmentsScreen />
}

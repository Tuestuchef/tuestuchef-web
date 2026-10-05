import type { Metadata } from "next"

import { requireSessionUser } from "@/common/lib/services/session.service"
import MaterialsScreen from "@/modules/orders/screens/materials-screen"

export const metadata: Metadata = { title: "Material necesario" }

export default async function MaterialsPage() {
  await requireSessionUser()
  return <MaterialsScreen />
}

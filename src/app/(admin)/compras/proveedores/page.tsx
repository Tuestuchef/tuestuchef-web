import type { Metadata } from "next"

import { requireSessionUser } from "@/common/lib/services/session.service"
import SuppliersScreen from "@/modules/purchases/screens/suppliers-screen"

export const metadata: Metadata = { title: "Proveedores" }

export default async function SuppliersPage() {
  const user = await requireSessionUser()
  return <SuppliersScreen user={user} />
}

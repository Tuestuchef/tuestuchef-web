import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import CatalogScreen from "@/modules/products/screens/catalog-screen"

export const metadata: Metadata = { title: "Tallas" }

export default async function SizesPage() {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <CatalogScreen kind="sizes" />
}

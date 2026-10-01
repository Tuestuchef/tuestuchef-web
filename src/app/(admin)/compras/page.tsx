import type { Metadata } from "next"

import { requireSessionUser } from "@/common/lib/services/session.service"
import { purchaseFiltersSchema } from "@/modules/purchases/lib/schemas/purchases.schema"
import PurchasesScreen from "@/modules/purchases/screens/purchases-screen"

export const metadata: Metadata = { title: "Compras" }

export default async function PurchasesPage({ searchParams }: PageProps<"/compras">) {
  const user = await requireSessionUser()
  const params = purchaseFiltersSchema.parse(await searchParams)
  return <PurchasesScreen user={user} filters={{ month: params.month, supplierId: params.supplier, status: params.status }} />
}

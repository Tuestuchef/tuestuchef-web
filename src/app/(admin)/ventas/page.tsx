import type { Metadata } from "next"

import { requireSessionUser } from "@/common/lib/services/session.service"
import { salesFiltersSchema } from "@/modules/sales/lib/schemas/sales.schema"
import SalesScreen from "@/modules/sales/screens/sales-screen"

export const metadata: Metadata = { title: "Ventas" }

export default async function SalesPage({ searchParams }: PageProps<"/ventas">) {
  const user = await requireSessionUser()
  const filters = salesFiltersSchema.parse(await searchParams)
  return <SalesScreen user={user} filters={filters} />
}

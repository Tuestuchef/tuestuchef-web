import type { Metadata } from "next"
import { z } from "zod"

import { requireSessionUser } from "@/common/lib/services/session.service"
import ProductsScreen from "@/modules/products/screens/products-screen"

export const metadata: Metadata = { title: "Combos" }

const filtersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  categoria: z.uuid().optional().catch(undefined),
})

export default async function CombosPage({ searchParams }: PageProps<"/productos/combos">) {
  const user = await requireSessionUser()
  const params = filtersSchema.parse(await searchParams)
  return (
    <ProductsScreen user={user} kind="combo" filters={{ search: params.q || undefined, categoryId: params.categoria }} />
  )
}

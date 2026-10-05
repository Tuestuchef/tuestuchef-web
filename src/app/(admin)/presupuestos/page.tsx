import type { Metadata } from "next"

import { requireSessionUser } from "@/common/lib/services/session.service"
import { quoteFiltersSchema } from "@/modules/quotes/lib/schemas/quote.schema"
import QuotesScreen from "@/modules/quotes/screens/quotes-screen"

export const metadata: Metadata = { title: "Presupuestos" }

export default async function QuotesPage({ searchParams }: PageProps<"/presupuestos">) {
  await requireSessionUser()
  const filters = quoteFiltersSchema.parse(await searchParams)
  return <QuotesScreen filters={filters} />
}

import type { Metadata } from "next"

import { requireSessionUser } from "@/common/lib/services/session.service"
import { customerFiltersSchema } from "@/modules/customers/lib/schemas/customers.schema"
import CustomersScreen from "@/modules/customers/screens/customers-screen"

export const metadata: Metadata = { title: "Clientes" }

export default async function CustomersPage({ searchParams }: PageProps<"/clientes">) {
  const user = await requireSessionUser()
  const { q } = customerFiltersSchema.parse(await searchParams)
  return <CustomersScreen user={user} search={q || undefined} />
}

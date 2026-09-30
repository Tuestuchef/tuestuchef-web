import type { Metadata } from "next"

import { requireSessionUser } from "@/common/lib/services/session.service"
import { movementFiltersSchema } from "@/modules/money-movements/lib/schemas/ledger-entry.schema"
import MovementsScreen from "@/modules/money-movements/screens/movements-screen"

export const metadata: Metadata = { title: "Movimientos" }

export default async function MovementsPage({ searchParams }: PageProps<"/movimientos">) {
  const user = await requireSessionUser()
  const params = movementFiltersSchema.parse(await searchParams)

  return (
    <MovementsScreen
      user={user}
      filters={{ month: params.month, accountId: params.account, direction: params.type }}
    />
  )
}

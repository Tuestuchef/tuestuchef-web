import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import TreasuryScreen from "@/modules/treasury/screens/treasury-screen"

export const metadata: Metadata = { title: "Tasas y cuentas" }

export default async function TreasuryPage({ searchParams }: PageProps<"/cuentas">) {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  const { traspaso } = await searchParams
  return <TreasuryScreen transferSaved={traspaso === "ok"} />
}

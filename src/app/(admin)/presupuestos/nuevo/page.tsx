import type { Metadata } from "next"

import { requireSessionUser } from "@/common/lib/services/session.service"
import QuoteFormScreen from "@/modules/quotes/screens/quote-form-screen"

export const metadata: Metadata = { title: "Nuevo presupuesto" }

export default async function NewQuotePage() {
  const user = await requireSessionUser()
  return <QuoteFormScreen user={user} />
}

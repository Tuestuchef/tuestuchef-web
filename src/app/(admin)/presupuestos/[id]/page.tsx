import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { requireSessionUser } from "@/common/lib/services/session.service"
import QuoteDetailScreen from "@/modules/quotes/screens/quote-detail-screen"

export const metadata: Metadata = { title: "Presupuesto" }

export default async function QuotePage({ params }: PageProps<"/presupuestos/[id]">) {
  const user = await requireSessionUser()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  return <QuoteDetailScreen user={user} id={id} />
}

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { requireSessionUser } from "@/common/lib/services/session.service"
import QuoteFormScreen from "@/modules/quotes/screens/quote-form-screen"

export const metadata: Metadata = { title: "Editar presupuesto" }

export default async function EditQuotePage({ params }: PageProps<"/presupuestos/[id]/editar">) {
  const user = await requireSessionUser()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  return <QuoteFormScreen user={user} id={id} />
}

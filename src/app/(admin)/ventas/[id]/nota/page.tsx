import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { requireSessionUser } from "@/common/lib/services/session.service"
import SaleNoteScreen from "@/modules/sales/screens/sale-note-screen"

export const metadata: Metadata = { title: "Nota de entrega" }

export default async function SaleNotePage({ params }: PageProps<"/ventas/[id]/nota">) {
  await requireSessionUser()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  return <SaleNoteScreen id={id} />
}

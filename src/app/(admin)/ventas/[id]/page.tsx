import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { requireSessionUser } from "@/common/lib/services/session.service"
import SaleDetailScreen from "@/modules/sales/screens/sale-detail-screen"

export const metadata: Metadata = { title: "Venta" }

export default async function SalePage({ params }: PageProps<"/ventas/[id]">) {
  const user = await requireSessionUser()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  return <SaleDetailScreen user={user} id={id} />
}

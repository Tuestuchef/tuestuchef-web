import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { requireSessionUser } from "@/common/lib/services/session.service"
import PurchaseDetailScreen from "@/modules/purchases/screens/purchase-detail-screen"

export const metadata: Metadata = { title: "Compra" }

export default async function PurchasePage({ params }: PageProps<"/compras/[id]">) {
  const user = await requireSessionUser()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  return <PurchaseDetailScreen user={user} id={id} />
}

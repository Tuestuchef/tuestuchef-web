import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { requireSessionUser } from "@/common/lib/services/session.service"
import OrderDetailScreen from "@/modules/orders/screens/order-detail-screen"

export const metadata: Metadata = { title: "Pedido" }

export default async function OrderPage({ params }: PageProps<"/pedidos/[id]">) {
  const user = await requireSessionUser()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  return <OrderDetailScreen user={user} id={id} />
}

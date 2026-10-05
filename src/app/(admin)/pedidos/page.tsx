import type { Metadata } from "next"
import { z } from "zod"

import { requireSessionUser } from "@/common/lib/services/session.service"
import OrdersScreen from "@/modules/orders/screens/orders-screen"

export const metadata: Metadata = { title: "Pedidos" }

const filtersSchema = z.object({
  estado: z.enum(["open", "late", "waiting", "in_production", "ready", "delivered", "cancelled"]).catch("open").default("open"),
})

export default async function OrdersPage({ searchParams }: PageProps<"/pedidos">) {
  await requireSessionUser()
  const { estado } = filtersSchema.parse(await searchParams)
  return <OrdersScreen filter={estado} />
}

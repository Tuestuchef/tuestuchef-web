import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { requireSessionUser } from "@/common/lib/services/session.service"
import CustomerDetailScreen from "@/modules/customers/screens/customer-detail-screen"

export const metadata: Metadata = { title: "Cliente" }

export default async function CustomerPage({ params }: PageProps<"/clientes/[id]">) {
  const user = await requireSessionUser()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  return <CustomerDetailScreen user={user} id={id} />
}

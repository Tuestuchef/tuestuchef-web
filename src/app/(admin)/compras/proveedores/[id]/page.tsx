import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { requireSessionUser } from "@/common/lib/services/session.service"
import SupplierDetailScreen from "@/modules/purchases/screens/supplier-detail-screen"

export const metadata: Metadata = { title: "Proveedor" }

export default async function SupplierPage({ params }: PageProps<"/compras/proveedores/[id]">) {
  const user = await requireSessionUser()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  return <SupplierDetailScreen user={user} id={id} />
}

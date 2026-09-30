import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { requireSessionUser } from "@/common/lib/services/session.service"
import ProductDetailScreen from "@/modules/products/screens/product-detail-screen"

export const metadata: Metadata = { title: "Producto" }

export default async function ProductPage({ params }: PageProps<"/productos/[id]">) {
  const user = await requireSessionUser()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  return <ProductDetailScreen user={user} id={id} />
}

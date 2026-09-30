import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import PaymentMethodsScreen from "@/modules/treasury/screens/payment-methods-screen"

export const metadata: Metadata = { title: "Métodos de pago" }

export default async function PaymentMethodsPage() {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <PaymentMethodsScreen />
}

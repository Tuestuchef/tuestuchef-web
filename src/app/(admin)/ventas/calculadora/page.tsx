import type { Metadata } from "next"

import { requireSessionUser } from "@/common/lib/services/session.service"
import PriceCalculatorScreen from "@/modules/sales/screens/price-calculator-screen"

export const metadata: Metadata = { title: "Calculadora de precios" }

export default async function PriceCalculatorPage() {
  await requireSessionUser()
  return <PriceCalculatorScreen />
}

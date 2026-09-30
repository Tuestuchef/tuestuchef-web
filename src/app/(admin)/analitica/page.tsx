import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import { DEFAULT_PERIOD, PERIODS, type PeriodValue } from "@/modules/analytics/lib/constants/analytics.constants"
import AnalyticsScreen from "@/modules/analytics/screens/analytics-screen"

export const metadata: Metadata = { title: "Analítica" }

export default async function AnalyticsPage({ searchParams }: PageProps<"/analitica">) {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  const { periodo } = await searchParams
  const period = PERIODS.some((p) => p.value === periodo) ? (periodo as PeriodValue) : DEFAULT_PERIOD
  return <AnalyticsScreen period={period} />
}

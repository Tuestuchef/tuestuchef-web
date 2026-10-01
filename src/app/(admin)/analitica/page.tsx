import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import {
  DASHBOARD_VIEWS,
  DEFAULT_PERIOD,
  DEFAULT_VIEW,
  type DashboardView,
  PERIODS,
  type PeriodValue,
} from "@/modules/analytics/lib/constants/analytics.constants"
import AnalyticsScreen from "@/modules/analytics/screens/analytics-screen"

export const metadata: Metadata = { title: "Dashboard" }

export default async function AnalyticsPage({ searchParams }: PageProps<"/analitica">) {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  const { periodo, vista } = await searchParams
  const period = PERIODS.some((p) => p.value === periodo) ? (periodo as PeriodValue) : DEFAULT_PERIOD
  const view = DASHBOARD_VIEWS.some((v) => v.value === vista) ? (vista as DashboardView) : DEFAULT_VIEW
  return <AnalyticsScreen period={period} view={view} />
}

import Link from "next/link"

import { cn } from "@/common/lib/utils"

import { DASHBOARD_VIEWS, type DashboardView } from "../lib/constants/analytics.constants"

// Pestañas como enlaces: la vista vive en la URL junto con el período.
const DashboardTabs = ({ view, period }: { view: DashboardView; period: string }) => (
  <nav aria-label="Vistas del dashboard" className="-mx-1 flex gap-1 overflow-x-auto px-1">
    {DASHBOARD_VIEWS.map((tab) => {
      const active = tab.value === view
      return (
        <Link
          key={tab.value}
          href={`?periodo=${period}&vista=${tab.value}`}
          scroll={false}
          aria-current={active ? "page" : undefined}
          className={cn(
            "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9",
            active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent hover:text-accent-foreground"
          )}
        >
          {tab.label}
        </Link>
      )
    })}
  </nav>
)

export default DashboardTabs

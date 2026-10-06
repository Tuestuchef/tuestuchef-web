import "server-only"

import type { NavBadges } from "@/common/lib/constants/navigation.constants"
import { isRoleIn, ROLE_GROUPS, type AppRole } from "@/common/lib/constants/roles.constants"
import { countMaterialShortages } from "@/modules/orders/lib/services/production.service"
import { countOpenOrders } from "@/modules/orders/lib/services/orders.service"
import { countPayables } from "@/modules/purchases/lib/services/purchases.service"
import { countOpenOfflineRejections } from "@/modules/sales/lib/services/offline-sales.service"
import { countReceivables } from "@/modules/sales/lib/services/sales.service"
import { getRateStatus } from "@/modules/treasury/lib/services/exchange-rates.service"

// Contadores del menú lateral. Lo que el rol no ve en el menú no se consulta (y queda en cero).
// Si una consulta falla, ese contador queda en cero: el menú nunca se rompe por esto.
export async function getNavBadges(role: AppRole): Promise<NavBadges> {
  const management = isRoleIn(role, ROLE_GROUPS.MANAGEMENT)
  const safe = <T,>(promise: Promise<T>, fallback: T) => promise.catch(() => fallback)

  const [receivables, offlineRejections, openOrders, materialShortages, payables, rate] = await Promise.all([
    management ? safe(countReceivables(), 0) : 0,
    safe(countOpenOfflineRejections(), 0),
    safe(countOpenOrders(), 0),
    safe(countMaterialShortages(), 0),
    management ? safe(countPayables(), 0) : 0,
    management ? safe(getRateStatus(), null) : null,
  ])

  return {
    receivables,
    offlineRejections,
    openOrders,
    materialShortages,
    payables,
    missingTodayRate: rate ? !rate.hasTodayRate : false,
  }
}

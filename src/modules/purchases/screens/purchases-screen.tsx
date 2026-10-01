import { PlusIcon } from "lucide-react"
import Link from "next/link"

import PageHeader from "@/common/components/page-header"
import { Button } from "@/common/components/ui/button"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import type { SessionUser } from "@/common/lib/types/session.types"
import { toCaracasDate } from "@/common/lib/utils/format-date.util"

import PurchaseFilters from "../components/purchase-filters"
import PurchaseList from "../components/purchase-list"
import { listPurchases } from "../lib/services/purchases.service"
import { listSuppliers } from "../lib/services/suppliers.service"
import type { PurchaseFilters as Filters } from "../lib/types/purchases.types"

const PurchasesScreen = async ({ user, filters }: { user: SessionUser; filters: Filters }) => {
  const canManage = isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)
  const [purchases, suppliers] = await Promise.all([listPurchases(filters), listSuppliers()])

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader
        help="purchases"
        title="Compras"
        description={canManage ? "Materia prima, mercancía y servicios a proveedores." : "Las compras que registraste."}
        actions={
          <Button asChild className="h-11 md:h-9">
            <Link href={ROUTES.NEW_PURCHASE}>
              <PlusIcon aria-hidden />
              Nueva compra
            </Link>
          </Button>
        }
      />
      <PurchaseFilters filters={filters} suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} />
      <PurchaseList purchases={purchases} today={toCaracasDate()} />
    </div>
  )
}

export default PurchasesScreen

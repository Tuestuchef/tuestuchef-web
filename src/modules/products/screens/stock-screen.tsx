import { FileSpreadsheetIcon } from "lucide-react"
import Link from "next/link"

import PageHeader from "@/common/components/page-header"
import { Button } from "@/common/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/common/components/ui/card"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import type { SessionUser } from "@/common/lib/types/session.types"
import { toCaracasDate } from "@/common/lib/utils/format-date.util"

import StockMovementForm from "../components/stock-movement-form"
import StockMovementList from "../components/stock-movement-list"
import { MANAGEMENT_MOVEMENT_TYPES, STAFF_MOVEMENT_TYPES } from "../lib/constants/products.constants"
import { listStockMovements, listStockVariantOptions } from "../lib/services/stock.service"

const StockScreen = async ({ user }: { user: SessionUser }) => {
  const canManage = isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)
  const [variants, movements] = await Promise.all([listStockVariantOptions(), listStockMovements({ limit: 30 })])

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader
        help="stock"
        title="Stock"
        description={canManage ? "Compras, producción y ajustes." : "Registra compras y producción."}
        actions={
          canManage && (
            <Button asChild variant="outline" className="h-11 md:h-9">
              <Link href={ROUTES.INITIAL_STOCK}>
                <FileSpreadsheetIcon aria-hidden />
                Carga inicial
              </Link>
            </Button>
          )
        }
      />
      <Card>
        <CardContent>
          {variants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay variantes activas con stock. Crea productos y sus variantes primero.
            </p>
          ) : (
            <StockMovementForm
              variants={variants}
              allowedTypes={canManage ? MANAGEMENT_MOVEMENT_TYPES : STAFF_MOVEMENT_TYPES}
              today={toCaracasDate()}
            />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Últimos movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <StockMovementList movements={movements} showAuthor={canManage} />
        </CardContent>
      </Card>
    </div>
  )
}

export default StockScreen

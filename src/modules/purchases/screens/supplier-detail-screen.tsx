import { ChevronLeftIcon, MailIcon, MessageCircleIcon, PhoneIcon, UserRoundIcon } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { Button } from "@/common/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/common/components/ui/card"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import type { SessionUser } from "@/common/lib/types/session.types"
import { toCaracasDate } from "@/common/lib/utils/format-date.util"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { formatPhone, whatsappUrl } from "@/modules/customers/lib/utils/normalize-contact.util"

import PurchaseList from "../components/purchase-list"
import SupplierFormDialog from "../components/supplier-form-dialog"
import { listPurchases } from "../lib/services/purchases.service"
import { getSupplier } from "../lib/services/suppliers.service"

const SupplierDetailScreen = async ({ user, id }: { user: SessionUser; id: string }) => {
  const canManage = isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)
  const [supplier, purchases] = await Promise.all([getSupplier(id), listPurchases({ supplierId: id })])
  if (!supplier) notFound()

  const open = purchases.filter((p) => p.status === "pending" || p.status === "partial")
  const owed = open.reduce((sum, p) => sum + p.balanceUsd, 0)
  const bought = purchases.filter((p) => p.status !== "voided").reduce((sum, p) => sum + p.totalUsd, 0)

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <Button asChild variant="ghost" className="h-auto w-fit px-0 text-muted-foreground">
        <Link href={ROUTES.SUPPLIERS}>
          <ChevronLeftIcon aria-hidden />
          Proveedores
        </Link>
      </Button>
      <PageHeader
        className="pt-0"
        help="supplier"
        title={supplier.name}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            {supplier.rif ?? "Sin RIF"}
            {!supplier.is_active && <StatusBadge tone="info">Inactivo</StatusBadge>}
          </span>
        }
        actions={canManage && <SupplierFormDialog supplier={supplier} canManage />}
      />

      {canManage && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 tabular-nums">
            <div className="grid gap-0.5">
              <span className="text-xs text-muted-foreground">Comprado (últimas 200)</span>
              <span className="text-lg font-semibold">{formatMoney(bought, "USD")}</span>
            </div>
            <div className="grid gap-0.5">
              <span className="text-xs text-muted-foreground">Le debemos</span>
              <span className="text-lg font-semibold">{formatMoney(owed, "USD")}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {(supplier.contact_name || supplier.phone || supplier.email || supplier.notes) && (
        <Card>
          <CardContent className="grid gap-2 text-sm">
            {supplier.contact_name && (
              <span className="flex items-center gap-2">
                <UserRoundIcon className="size-4 text-muted-foreground" aria-hidden />
                {supplier.contact_name}
              </span>
            )}
            {supplier.phone && (
              <span className="flex flex-wrap items-center gap-2">
                <PhoneIcon className="size-4 text-muted-foreground" aria-hidden />
                <a href={`tel:${supplier.phone}`} className="underline-offset-4 hover:underline">
                  {formatPhone(supplier.phone)}
                </a>
                <Button asChild variant="outline" size="sm">
                  <a href={whatsappUrl(supplier.phone)} target="_blank" rel="noreferrer">
                    <MessageCircleIcon aria-hidden />
                    WhatsApp
                  </a>
                </Button>
              </span>
            )}
            {supplier.email && (
              <span className="flex items-center gap-2">
                <MailIcon className="size-4 text-muted-foreground" aria-hidden />
                <a href={`mailto:${supplier.email}`} className="underline-offset-4 hover:underline">
                  {supplier.email}
                </a>
              </span>
            )}
            {supplier.notes && <p className="whitespace-pre-line text-muted-foreground">{supplier.notes}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Compras</CardTitle>
        </CardHeader>
        <CardContent>
          <PurchaseList purchases={purchases} today={toCaracasDate()} />
        </CardContent>
      </Card>
    </div>
  )
}

export default SupplierDetailScreen

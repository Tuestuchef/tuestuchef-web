import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"

import StatusBadge from "@/common/components/status-badge"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { formatPhone } from "@/modules/customers/lib/utils/normalize-contact.util"

import type { SupplierListItem } from "../lib/types/purchases.types"

const SupplierList = ({ suppliers }: { suppliers: SupplierListItem[] }) => {
  if (suppliers.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay proveedores.</p>
  }

  return (
    <ul className="divide-y rounded-lg border">
      {suppliers.map((supplier) => (
        <li key={supplier.id}>
          <Link
            href={ROUTES.SUPPLIER(supplier.id)}
            className="flex items-center gap-3 p-3 transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="grid min-w-0 flex-1 gap-0.5">
              <span className="flex flex-wrap items-center gap-1.5 font-medium">
                {supplier.name}
                {!supplier.is_active && <StatusBadge tone="info">Inactivo</StatusBadge>}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {[supplier.rif, supplier.contact_name, supplier.phone && formatPhone(supplier.phone)]
                  .filter(Boolean)
                  .join(" · ") || "Sin datos de contacto"}
              </span>
            </div>
            {supplier.balanceUsd !== null && supplier.balanceUsd > 0.01 && (
              <span className="text-right text-sm tabular-nums">
                <span className="block text-xs text-muted-foreground">Le debemos</span>
                {formatMoney(supplier.balanceUsd, "USD")}
              </span>
            )}
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default SupplierList

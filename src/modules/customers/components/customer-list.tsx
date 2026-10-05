import { AtSignIcon, ChevronRightIcon, MailIcon, PhoneIcon } from "lucide-react"
import Link from "next/link"

import StatusBadge from "@/common/components/status-badge"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import type { CustomerListItem } from "../lib/types/customers.types"
import { formatPhone } from "../lib/utils/normalize-contact.util"

const CustomerList = ({ customers, searching }: { customers: CustomerListItem[]; searching: boolean }) => {
  if (customers.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {searching ? "Ningún cliente coincide con la búsqueda." : "Aún no hay clientes."}
      </p>
    )
  }

  return (
    <ul className="divide-y rounded-lg border">
      {customers.map((customer) => (
        <li key={customer.id}>
          <Link
            href={ROUTES.CUSTOMER(customer.id)}
            className="flex items-center gap-3 p-3 transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="grid min-w-0 flex-1 gap-0.5">
              <span className="flex flex-wrap items-center gap-1.5 font-medium">
                {[customer.first_name, customer.last_name].filter(Boolean).join(" ")}
                {customer.kind === "company" && <StatusBadge tone="info">Empresa</StatusBadge>}
                {!customer.is_active && <StatusBadge tone="info">Inactivo</StatusBadge>}
              </span>
              {customer.kind === "company" && customer.legal_name && customer.legal_name !== customer.first_name && (
                <span className="truncate text-xs text-muted-foreground">{customer.legal_name}</span>
              )}
              <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {customer.phone && (
                  <span className="inline-flex items-center gap-1">
                    <PhoneIcon className="size-3" aria-hidden />
                    {formatPhone(customer.phone)}
                  </span>
                )}
                {customer.email && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MailIcon className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">{customer.email}</span>
                  </span>
                )}
                {customer.instagram && (
                  <span className="inline-flex items-center gap-1">
                    <AtSignIcon className="size-3" aria-hidden />
                    {customer.instagram}
                  </span>
                )}
              </span>
            </div>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default CustomerList

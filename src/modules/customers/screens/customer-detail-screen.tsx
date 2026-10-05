import {
  AtSignIcon,
  Building2Icon,
  ChevronLeftIcon,
  FileTextIcon,
  IdCardIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
  UserRoundIcon,
} from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import PageHeader from "@/common/components/page-header"
import StatusAlert from "@/common/components/status-alert"
import StatusBadge from "@/common/components/status-badge"
import { Button } from "@/common/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/common/components/ui/card"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import type { SessionUser } from "@/common/lib/types/session.types"
import { formatDate } from "@/common/lib/utils/format-date.util"
import MessageHistory from "@/modules/messages/components/message-history"
import SaleList from "@/modules/sales/components/sale-list"
import { listSales } from "@/modules/sales/lib/services/sales.service"

import CustomerBlockDialog from "../components/customer-block-dialog"
import CustomerFormDialog from "../components/customer-form-dialog"
import { getCustomer, listCustomerBlockEvents } from "../lib/services/customers.service"
import { formatPhone, formatTaxId, whatsappUrl } from "../lib/utils/normalize-contact.util"

const Row = ({ icon: Icon, label, children }: { icon: typeof PhoneIcon; label: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-3 py-2.5">
    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
    <div className="grid min-w-0 gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="break-words text-sm">{children}</span>
    </div>
  </div>
)

const CustomerDetailScreen = async ({ user, id }: { user: SessionUser; id: string }) => {
  const canManage = isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)
  const [customer, sales] = await Promise.all([
    getCustomer(id, { withIdDocument: canManage }),
    listSales({ customerId: id }),
  ])
  if (!customer) notFound()
  const blockEvents = await listCustomerBlockEvents(id)

  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ")

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <Button asChild variant="ghost" className="h-auto w-fit px-0 text-muted-foreground">
        <Link href={ROUTES.CUSTOMERS}>
          <ChevronLeftIcon aria-hidden />
          Clientes
        </Link>
      </Button>
      <PageHeader
        help="customer"
        className="pt-0"
        title={name}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            Cliente desde {formatDate(customer.created_at)}
            {customer.kind === "company" && <StatusBadge tone="info">Empresa</StatusBadge>}
            {!customer.is_active && <StatusBadge tone="info">Inactivo</StatusBadge>}
            {customer.blocked_at && <StatusBadge tone="error">Bloqueado</StatusBadge>}
          </span>
        }
        actions={
          <>
            <CustomerFormDialog customer={customer} canManage={canManage} />
            {canManage && <CustomerBlockDialog customerId={customer.id} blocked={Boolean(customer.blocked_at)} />}
          </>
        }
      />
      {customer.blocked_at && (
        <StatusAlert tone="error" title="Cliente bloqueado: no se le puede vender">
          {customer.blocked_reason} · desde el {formatDate(customer.blocked_at)}.
        </StatusAlert>
      )}
      {blockEvents.length > 0 && (
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">Historial de bloqueos</summary>
          <ul className="mt-2 grid gap-1">
            {blockEvents.map((e) => (
              <li key={e.id}>
                {e.action === "block" ? "Bloqueado" : "Desbloqueado"} el {formatDate(e.at)}
                {e.byName ? ` por ${e.byName}` : ""}: <span className="text-muted-foreground">{e.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Card>
        <CardContent className="divide-y">
          {customer.kind === "company" && (
            <>
              <Row icon={Building2Icon} label="Razón social">
                {customer.legal_name}
              </Row>
              <Row icon={FileTextIcon} label="RIF">
                {customer.tax_id ? formatTaxId(customer.tax_id) : <span className="text-muted-foreground">No registrado</span>}
              </Row>
              {customer.contact_person && (
                <Row icon={UserRoundIcon} label="Persona de contacto">
                  {customer.contact_person}
                </Row>
              )}
            </>
          )}
          {customer.phone && (
            <Row icon={PhoneIcon} label="Teléfono">
              <span className="flex flex-wrap items-center gap-2">
                <a href={`tel:${customer.phone}`} className="underline-offset-4 hover:underline">
                  {formatPhone(customer.phone)}
                </a>
                <Button asChild variant="outline" size="sm">
                  <a href={whatsappUrl(customer.phone)} target="_blank" rel="noreferrer">
                    <MessageCircleIcon aria-hidden />
                    WhatsApp
                  </a>
                </Button>
              </span>
            </Row>
          )}
          {customer.email && (
            <Row icon={MailIcon} label="Correo">
              <a href={`mailto:${customer.email}`} className="underline-offset-4 hover:underline">
                {customer.email}
              </a>
            </Row>
          )}
          {customer.instagram && (
            <Row icon={AtSignIcon} label="Instagram">
              <a
                href={`https://instagram.com/${customer.instagram}`}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-4 hover:underline"
              >
                @{customer.instagram}
              </a>
            </Row>
          )}
          {customer.kind === "person" && (
            <Row icon={IdCardIcon} label="Cédula">
              {canManage ? (
                (customer.idDocument ?? <span className="text-muted-foreground">No registrada</span>)
              ) : customer.has_id_document ? (
                <StatusBadge tone="success">Registrada</StatusBadge>
              ) : (
                <span className="text-muted-foreground">No registrada</span>
              )}
            </Row>
          )}
          {customer.address && (
            <Row icon={MapPinIcon} label="Dirección">
              {customer.address}
            </Row>
          )}
          {customer.notes && <p className="py-2.5 text-sm whitespace-pre-line">{customer.notes}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compras</CardTitle>
        </CardHeader>
        <CardContent>
          <SaleList sales={sales} groupByDay={false} emptyMessage="Aún no tiene compras." />
        </CardContent>
      </Card>

      <MessageHistory filter={{ customerId: customer.id }} />
    </div>
  )
}

export default CustomerDetailScreen

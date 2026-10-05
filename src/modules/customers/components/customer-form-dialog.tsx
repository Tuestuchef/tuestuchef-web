"use client"

import { ExternalLinkIcon, PencilIcon, UserCheckIcon, UserPlusIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import ActiveSwitchField from "@/common/components/active-switch-field"
import ChoiceChips from "@/common/components/choice-chips"
import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/common/components/ui/dialog"
import { Input } from "@/common/components/ui/input"
import { Textarea } from "@/common/components/ui/textarea"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { saveCustomerAction } from "../lib/actions/save-customer.action"
import { CUSTOMER_KIND_LABELS } from "../lib/constants/customers.constants"
import type { CustomerDetail } from "../lib/types/customers.types"
import { formatPhone, formatTaxId } from "../lib/utils/normalize-contact.util"

const KIND_OPTIONS = [
  { value: "person", label: CUSTOMER_KIND_LABELS.person },
  { value: "company", label: CUSTOMER_KIND_LABELS.company },
] as const

type CustomerFormDialogProps = {
  customer?: CustomerDetail
  canManage: boolean
  // Al crear desde otra pantalla (p. ej. una venta): recibe el id en vez de navegar.
  onSaved?: (customer: { id: string; name: string }) => void
  trigger?: React.ReactNode
}

// Crear o editar un cliente. Persona: nombre y un medio de contacto. Empresa: solo la razón social.
const CustomerFormDialog = ({ customer, canManage, onSaved, trigger }: CustomerFormDialogProps) => {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<"person" | "company">(customer?.kind ?? "person")
  const isCompany = kind === "company"
  const { state, onSubmit, pending } = useFormAction(saveCustomerAction)
  useActionFeedback(state, () => {
    setOpen(false)
    if (state.customerId) onSaved?.({ id: state.customerId, name: state.customerName ?? "" })
  })
  const errors = state.fieldErrors ?? {}
  const duplicate = state.status === "error" ? state.duplicate : undefined

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ??
          (customer ? (
            <Button variant="outline" className="h-11 md:h-9">
              <PencilIcon aria-hidden />
              Editar
            </Button>
          ) : (
            <Button className="h-11 md:h-9">
              <UserPlusIcon aria-hidden />
              Nuevo cliente
            </Button>
          ))}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          <DialogDescription>
            {isCompany ? "Para una empresa basta con la razón social." : "Nombre y al menos un teléfono, correo o Instagram."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {customer && <input type="hidden" name="id" value={customer.id} />}
          <input type="hidden" name="kind" value={kind} />
          <ChoiceChips label="Tipo de cliente" options={KIND_OPTIONS} value={kind} onChange={(value) => setKind(value as typeof kind)} />

          {duplicate ? (
            <StatusAlert tone="warning" title={state.message ?? "Ese cliente ya existe."}>
              {onSaved ? (
                // Desde otra pantalla (p. ej. una venta): usarlo sin salir de ella.
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    onSaved({ id: duplicate.id, name: duplicate.name })
                    setOpen(false)
                  }}
                >
                  <UserCheckIcon aria-hidden />
                  Usar {duplicate.name}
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link href={ROUTES.CUSTOMER(duplicate.id)} onClick={() => setOpen(false)}>
                    <ExternalLinkIcon aria-hidden />
                    Abrir {duplicate.name}
                  </Link>
                </Button>
              )}
            </StatusAlert>
          ) : (
            state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />
          )}

          {isCompany ? (
            <>
              <FormField label="Razón social" htmlFor="customer-legal-name" error={errors.legal_name} hint="Como aparece en su RIF.">
                <Input id="customer-legal-name" name="legal_name" autoComplete="off" defaultValue={customer?.legal_name ?? ""} className="h-11 md:h-9" />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Nombre comercial" htmlFor="customer-first-name" error={errors.first_name} optional hint="Como lo conocen. Si no, se usa la razón social.">
                  <Input id="customer-first-name" name="first_name" autoComplete="off" defaultValue={customer?.kind === "company" ? customer.first_name : ""} className="h-11 md:h-9" />
                </FormField>
                <FormField label="RIF" htmlFor="customer-tax-id" error={errors.tax_id} optional>
                  <Input
                    id="customer-tax-id"
                    name="tax_id"
                    autoComplete="off"
                    autoCapitalize="characters"
                    placeholder="J-12345678-9"
                    defaultValue={customer?.tax_id ? formatTaxId(customer.tax_id) : ""}
                    className="h-11 md:h-9"
                  />
                </FormField>
              </div>
              <FormField label="Persona de contacto" htmlFor="customer-contact-person" error={errors.contact_person} optional>
                <Input id="customer-contact-person" name="contact_person" autoComplete="off" defaultValue={customer?.contact_person ?? ""} className="h-11 md:h-9" />
              </FormField>
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Nombre" htmlFor="customer-first-name" error={errors.first_name}>
                <Input
                  id="customer-first-name"
                  name="first_name"
                  autoComplete="off"
                  defaultValue={customer?.kind === "person" ? customer.first_name : ""}
                  className="h-11 md:h-9"
                />
              </FormField>
              <FormField label="Apellido" htmlFor="customer-last-name" error={errors.last_name} optional>
                <Input
                  id="customer-last-name"
                  name="last_name"
                  autoComplete="off"
                  defaultValue={customer?.last_name ?? ""}
                  className="h-11 md:h-9"
                />
              </FormField>
            </div>
          )}

          <FormField label="Teléfono" htmlFor="customer-phone" error={errors.phone} optional={isCompany} hint="Ej.: 0414-123.45.67">
            <Input
              id="customer-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              defaultValue={customer?.phone ? formatPhone(customer.phone) : ""}
              className="h-11 md:h-9"
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Correo" htmlFor="customer-email" error={errors.email} optional={isCompany}>
              <Input
                id="customer-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                defaultValue={customer?.email ?? ""}
                className="h-11 md:h-9"
              />
            </FormField>
            <FormField label="Instagram" htmlFor="customer-instagram" error={errors.instagram} optional={isCompany}>
              <Input
                id="customer-instagram"
                name="instagram"
                autoCapitalize="none"
                autoComplete="off"
                placeholder="@usuario"
                defaultValue={customer?.instagram ? `@${customer.instagram}` : ""}
                className="h-11 md:h-9"
              />
            </FormField>
          </div>

          {!isCompany && (
            <FormField
              label="Cédula"
              htmlFor="customer-id-document"
              error={errors.id_document}
              optional
              hint={
                customer?.has_id_document && !canManage
                  ? "Ya tiene cédula registrada. Escribe otra solo para corregirla."
                  : "Ej.: V-12.345.678. Solo owner y admin pueden verla."
              }
            >
              <Input
                id="customer-id-document"
                name="id_document"
                autoComplete="off"
                autoCapitalize="characters"
                defaultValue={canManage ? (customer?.idDocument ?? "") : ""}
                className="h-11 md:h-9"
              />
            </FormField>
          )}

          <FormField label="Dirección" htmlFor="customer-address" error={errors.address} optional>
            <Input id="customer-address" name="address" autoComplete="off" defaultValue={customer?.address ?? ""} className="h-11 md:h-9" />
          </FormField>

          <FormField label="Notas" htmlFor="customer-notes" error={errors.notes} optional>
            <Textarea
              id="customer-notes"
              name="notes"
              rows={2}
              placeholder="Ej.: talla habitual, restaurante donde trabaja"
              defaultValue={customer?.notes ?? ""}
            />
          </FormField>

          {customer && canManage && (
            <ActiveSwitchField
              defaultChecked={customer.is_active}
              label="Cliente activo"
              description="Los inactivos no aparecen al registrar ventas."
            />
          )}

          <SubmitButton pending={pending}>{customer ? "Guardar cambios" : "Crear cliente"}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CustomerFormDialog

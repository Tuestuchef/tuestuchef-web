"use client"

import { PencilIcon, PlusIcon } from "lucide-react"
import { useState } from "react"

import ActiveSwitchField from "@/common/components/active-switch-field"
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
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"
import { formatPhone } from "@/modules/customers/lib/utils/normalize-contact.util"

import { saveSupplierAction } from "../lib/actions/save-supplier.action"
import type { Supplier } from "../lib/types/purchases.types"

type SupplierFormDialogProps = {
  supplier?: Supplier
  canManage: boolean
  // Al crearlo desde una compra: lo selecciona sin salir.
  onSaved?: (supplier: { id: string; name: string }) => void
  trigger?: React.ReactNode
}

const SupplierFormDialog = ({ supplier, canManage, onSaved, trigger }: SupplierFormDialogProps) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(saveSupplierAction)
  useActionFeedback(state, () => {
    setOpen(false)
    if (state.supplier) onSaved?.(state.supplier)
  })
  const errors = state.fieldErrors ?? {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ??
          (supplier ? (
            <Button variant="outline" className="h-11 md:h-9">
              <PencilIcon aria-hidden />
              Editar
            </Button>
          ) : (
            <Button className="h-11 md:h-9">
              <PlusIcon aria-hidden />
              Nuevo proveedor
            </Button>
          ))}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
          <DialogDescription>Solo el nombre es obligatorio.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {supplier && <input type="hidden" name="id" value={supplier.id} />}
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

          <FormField label="Nombre" htmlFor="supplier-name" error={errors.name}>
            <Input id="supplier-name" name="name" autoComplete="off" defaultValue={supplier?.name} className="h-11 md:h-9" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="RIF" htmlFor="supplier-rif" error={errors.rif} optional hint="Ej.: J-40123456-7">
              <Input
                id="supplier-rif"
                name="rif"
                autoCapitalize="characters"
                autoComplete="off"
                defaultValue={supplier?.rif ?? ""}
                className="h-11 md:h-9"
              />
            </FormField>
            <FormField label="Contacto" htmlFor="supplier-contact" error={errors.contact_name} optional>
              <Input
                id="supplier-contact"
                name="contact_name"
                autoComplete="off"
                defaultValue={supplier?.contact_name ?? ""}
                className="h-11 md:h-9"
              />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Teléfono" htmlFor="supplier-phone" error={errors.phone} optional>
              <Input
                id="supplier-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                defaultValue={supplier?.phone ? formatPhone(supplier.phone) : ""}
                className="h-11 md:h-9"
              />
            </FormField>
            <FormField label="Correo" htmlFor="supplier-email" error={errors.email} optional>
              <Input
                id="supplier-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                defaultValue={supplier?.email ?? ""}
                className="h-11 md:h-9"
              />
            </FormField>
          </div>
          <FormField label="Tipo" htmlFor="supplier-kind" hint="Un taller (confección, bordado) puede recibir etapas de los pedidos.">
            <select id="supplier-kind" name="kind" defaultValue={supplier?.kind ?? "goods"} className="h-11 rounded-md border bg-background px-2 text-sm md:h-9">
              <option value="goods">Proveedor (telas, insumos, servicios)</option>
              <option value="workshop">Taller (confección o bordado)</option>
            </select>
          </FormField>
          <FormField label="Notas" htmlFor="supplier-notes" error={errors.notes} optional>
            <Textarea
              id="supplier-notes"
              name="notes"
              rows={2}
              placeholder="Ej.: qué vende, condiciones de crédito"
              defaultValue={supplier?.notes ?? ""}
            />
          </FormField>
          {supplier && canManage && (
            <ActiveSwitchField
              defaultChecked={supplier.is_active}
              label="Proveedor activo"
              description="Los inactivos no aparecen al registrar compras."
            />
          )}
          <SubmitButton pending={pending}>{supplier ? "Guardar cambios" : "Crear proveedor"}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default SupplierFormDialog

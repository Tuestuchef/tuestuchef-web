"use client"

import { PencilIcon } from "lucide-react"
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

import { saveCustomizationTypeAction } from "../lib/actions/order-settings.action"
import type { CustomizationType } from "../lib/types/orders.types"

const decimal = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 })
const asText = (value: number | null) => (value === null ? "" : decimal.format(value))

// Editar precio, mínimo y medidas de un tipo de personalización.
const CustomizationTypeDialog = ({ type }: { type: CustomizationType }) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(saveCustomizationTypeAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Editar ${type.name}`}>
          <PencilIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar {type.name}</DialogTitle>
          <DialogDescription>
            Precio en USD de referencia, igual para todos los métodos de pago (en Bs se cobra a la tasa BCV del día).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="id" value={type.id} />
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          <FormField label="Nombre" htmlFor="ct-name" error={errors.name}>
            <Input id="ct-name" name="name" defaultValue={type.name} className="h-11 md:h-9" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Precio por unidad (USD)"
              htmlFor="ct-price"
              error={errors.unit_price_usd}
              optional
              hint="Vacío = sin precio: no se puede usar todavía."
            >
              <Input id="ct-price" name="unit_price_usd" inputMode="decimal" defaultValue={asText(type.unitPriceUsd)} className="h-11 md:h-9" />
            </FormField>
            <FormField label="Mínimo de piezas" htmlFor="ct-min" error={errors.min_quantity}>
              <Input id="ct-min" name="min_quantity" inputMode="numeric" defaultValue={type.minQuantity} className="h-11 md:h-9" />
            </FormField>
          </div>
          {type.requiresLogo && (
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Medida máxima (cm)"
                htmlFor="ct-max"
                error={errors.max_size_cm}
                optional
                hint="Más grande se trata como otro tipo."
              >
                <Input id="ct-max" name="max_size_cm" inputMode="decimal" defaultValue={asText(type.maxSizeCm)} className="h-11 md:h-9" />
              </FormField>
              <FormField label="Medida de referencia (cm)" htmlFor="ct-default" error={errors.default_size_cm} optional>
                <Input
                  id="ct-default"
                  name="default_size_cm"
                  inputMode="decimal"
                  defaultValue={asText(type.defaultSizeCm)}
                  className="h-11 md:h-9"
                />
              </FormField>
            </div>
          )}
          <FormField label="Descripción" htmlFor="ct-description" error={errors.description} optional>
            <Textarea id="ct-description" name="description" rows={2} defaultValue={type.description ?? ""} />
          </FormField>
          <ActiveSwitchField defaultChecked={type.isActive} label="Activa" description="Inactiva: no se ofrece en pedidos nuevos." />
          <SubmitButton pending={pending}>Guardar cambios</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CustomizationTypeDialog

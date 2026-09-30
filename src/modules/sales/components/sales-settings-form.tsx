"use client"

import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Input } from "@/common/components/ui/input"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { saveSalesSettingsAction } from "../lib/actions/sale-operations.action"

type SalesSettingsFormProps = { staffMaxDiscountPercent: number; staffMaxBackdateDays: number }

const SalesSettingsForm = ({ staffMaxDiscountPercent, staffMaxBackdateDays }: SalesSettingsFormProps) => {
  const { state, onSubmit, pending } = useFormAction(saveSalesSettingsAction)
  useActionFeedback(state)

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
      <FormField
        label="Descuento máximo para staff (%)"
        htmlFor="max-discount"
        hint="Por encima de este porcentaje, solo owner o admin pueden aplicar el descuento."
      >
        <Input
          id="max-discount"
          name="staff_max_discount_percent"
          inputMode="decimal"
          defaultValue={String(staffMaxDiscountPercent)}
          className="h-11 max-w-32 md:h-9"
        />
      </FormField>
      <FormField
        label="Días hacia atrás para staff"
        htmlFor="max-backdate"
        hint="Staff puede registrar ventas, pagos y movimientos con fecha pasada hasta este límite. Más atrás, solo owner o admin."
      >
        <Input
          id="max-backdate"
          name="staff_max_backdate_days"
          type="number"
          min={0}
          max={365}
          inputMode="numeric"
          defaultValue={String(staffMaxBackdateDays)}
          className="h-11 max-w-32 md:h-9"
        />
      </FormField>
      <SubmitButton pending={pending} className="w-fit">
        Guardar
      </SubmitButton>
    </form>
  )
}

export default SalesSettingsForm

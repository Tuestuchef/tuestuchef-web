"use client"

import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Input } from "@/common/components/ui/input"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { saveOrderSettingsAction } from "../lib/actions/orders.action"
import type { OrderSettings } from "../lib/types/orders.types"

const decimal = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 })

// Abono para empezar a producir y fecha prometida por defecto.
const OrderSettingsForm = ({ settings }: { settings: OrderSettings }) => {
  const { state, onSubmit, pending } = useFormAction(saveOrderSettingsAction)
  useActionFeedback(state)
  const errors = state.fieldErrors ?? {}

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Desde (USD)" htmlFor="os-threshold" error={errors.deposit_threshold_usd} hint="Por debajo: pago completo.">
          <Input
            id="os-threshold"
            name="deposit_threshold_usd"
            inputMode="decimal"
            defaultValue={decimal.format(settings.depositThresholdUsd)}
            className="h-11 md:h-9"
          />
        </FormField>
        <FormField label="Abono (%)" htmlFor="os-percent" error={errors.deposit_percent} hint="El resto al entregar.">
          <Input id="os-percent" name="deposit_percent" inputMode="decimal" defaultValue={decimal.format(settings.depositPercent)} className="h-11 md:h-9" />
        </FormField>
        <FormField label="Días de entrega" htmlFor="os-days" error={errors.default_lead_days} hint="Fecha prometida por defecto.">
          <Input id="os-days" name="default_lead_days" inputMode="numeric" defaultValue={settings.defaultLeadDays} className="h-11 md:h-9" />
        </FormField>
      </div>
      <SubmitButton pending={pending} className="w-fit">
        Guardar
      </SubmitButton>
    </form>
  )
}

export default OrderSettingsForm

"use client"

import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Input } from "@/common/components/ui/input"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { createExchangeRateAction } from "../lib/actions/create-exchange-rate.action"
import type { ExchangeRateField } from "../lib/schemas/exchange-rate.schema"

type ExchangeRateFormProps = {
  onSuccess?: () => void
  submitLabel?: string
  // Valores actuales: la persona cambia solo la tasa que quiere ajustar.
  defaults?: Partial<Record<"bcv_usd" | "bcv_eur" | "binance_usdt", number>>
}

const RATE_FIELDS: { name: ExchangeRateField; label: string; hint?: string }[] = [
  { name: "binance_usdt", label: "USDT / paralelo (Bs)" },
  { name: "bcv_usd", label: "BCV dólar (Bs)" },
  { name: "bcv_eur", label: "BCV euro (Bs)" },
]

const ExchangeRateForm = ({ onSuccess, submitLabel = "Guardar tasa del día", defaults }: ExchangeRateFormProps) => {
  const { state, onSubmit, pending } = useFormAction(createExchangeRateAction)
  useActionFeedback(state, onSuccess)
  const errors = state.fieldErrors ?? {}

  return (
    <form key={state.submissionId} onSubmit={onSubmit} className="grid gap-4" noValidate>
      {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

      <div className="grid gap-4 sm:grid-cols-3">
        {RATE_FIELDS.map((field) => (
          <FormField key={field.name} label={field.label} htmlFor={`rate-${field.name}`} error={errors[field.name]}>
            <Input
              id={`rate-${field.name}`}
              name={field.name}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              defaultValue={
                field.name !== "usd_usdt" && field.name !== "note" && defaults?.[field.name] !== undefined
                  ? String(defaults[field.name]).replace(".", ",")
                  : undefined
              }
              aria-invalid={Boolean(errors[field.name])}
              className="h-11 md:h-9"
            />
          </FormField>
        ))}
      </div>

      <details className="group rounded-lg border px-3 py-2 text-sm">
        <summary className="cursor-pointer text-muted-foreground">Más opciones</summary>
        <div className="grid gap-4 pt-3 sm:grid-cols-2">
          <FormField
            label="USD → USDT"
            htmlFor="rate-usd_usdt"
            error={errors.usd_usdt}
            hint="Cuántos USDT vale 1 dólar. Por defecto 1."
            optional
          >
            <Input id="rate-usd_usdt" name="usd_usdt" inputMode="decimal" placeholder="1" className="h-11 md:h-9" />
          </FormField>
          <FormField label="Nota" htmlFor="rate-note" error={errors.note} optional>
            <Input id="rate-note" name="note" className="h-11 md:h-9" />
          </FormField>
        </div>
      </details>

      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </form>
  )
}

export default ExchangeRateForm

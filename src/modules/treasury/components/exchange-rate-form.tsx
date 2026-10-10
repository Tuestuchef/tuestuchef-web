"use client"

import { useState, useTransition } from "react"

import DateField from "@/common/components/date-field"
import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Input } from "@/common/components/ui/input"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { createExchangeRateAction, getHistoricalRatesAction } from "../lib/actions/create-exchange-rate.action"
import type { ExchangeRateField } from "../lib/schemas/exchange-rate.schema"

type ExchangeRateFormProps = {
  onSuccess?: () => void
  submitLabel?: string
  // Valores actuales: la persona cambia solo la tasa que quiere ajustar.
  defaults?: Partial<Record<"bcv_usd" | "bcv_eur" | "binance_usdt", number>>
  // Owner y admin: cargar la tasa de una fecha pasada.
  maxDate?: string
}

type RateField = Extract<ExchangeRateField, "bcv_usd" | "bcv_eur" | "binance_usdt">

const RATE_FIELDS: { name: RateField; label: string; hint?: string }[] = [
  { name: "binance_usdt", label: "USDT / paralelo (Bs)" },
  { name: "bcv_usd", label: "BCV dólar (Bs)" },
  { name: "bcv_eur", label: "BCV euro (Bs)" },
]

const ExchangeRateForm = ({ onSuccess, submitLabel = "Guardar tasa del día", defaults, maxDate }: ExchangeRateFormProps) => {
  const { state, onSubmit, pending } = useFormAction(createExchangeRateAction)
  useActionFeedback(state, onSuccess)
  const errors = state.fieldErrors ?? {}
  // Fecha pasada: las tasas se llenan solas desde el historial de DolarAPI (se pueden ajustar).
  const [date, setDate] = useState("")
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getHistoricalRatesAction>> | "none" | null>(null)
  const [loading, startLoading] = useTransition()
  const values: Partial<Record<RateField, number>> =
    history && history !== "none"
      ? { binance_usdt: history.parallelUsd, bcv_usd: history.bcvUsd, bcv_eur: history.bcvEur }
      : (defaults ?? {})

  const changeDate = (next: string) => {
    setDate(next)
    setHistory(null)
    if (!next) return
    startLoading(async () => setHistory((await getHistoricalRatesAction(next)) ?? "none"))
  }

  return (
    <form key={state.submissionId} onSubmit={onSubmit} className="grid gap-4" noValidate>
      {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

      {maxDate && (
        <FormField label="Fecha de la tasa" htmlFor="rate-date" error={errors.rate_date}>
          <DateField id="rate-date" name="rate_date" max={maxDate} value={date} onChange={changeDate} required />
        </FormField>
      )}
      {maxDate && date && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {loading
            ? "Buscando las tasas de ese día…"
            : history === "none"
              ? "No hay datos de ese día en el historial: escríbelas."
              : history?.estimated
                ? `Del historial de DolarAPI. Ese día no tiene paralelo: el USDT se estimó desde el ${history.parallelFrom.split("-").reverse().join("/")}.`
                : history
                  ? "Del historial de DolarAPI. Revisa y guarda."
                  : null}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {RATE_FIELDS.map((field) => (
          <FormField key={`${field.name}-${values[field.name] ?? ""}`} label={field.label} htmlFor={`rate-${field.name}`} error={errors[field.name]}>
            <Input
              id={`rate-${field.name}`}
              name={field.name}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              defaultValue={values[field.name] !== undefined ? String(values[field.name]).replace(".", ",") : undefined}
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

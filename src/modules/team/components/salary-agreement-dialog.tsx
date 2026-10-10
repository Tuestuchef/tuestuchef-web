"use client"

import { BadgeDollarSignIcon } from "lucide-react"
import { useState } from "react"

import DateField from "@/common/components/date-field"
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
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { addSalaryAgreementAction } from "../lib/actions/team.action"
import { FREQUENCY_LABELS, SALARY_PAY_OPTIONS, type SalaryFrequency } from "../lib/constants/team.constants"
import type { Salary } from "../lib/types/team.types"

// Sueldo nuevo o cambio de sueldo: se agrega un acuerdo (los anteriores quedan como historial).
const SalaryAgreementDialog = ({ memberId, current, today }: { memberId: string; current: Salary | null; today: string }) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(addSalaryAgreementAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 md:h-9">
          <BadgeDollarSignIcon aria-hidden />
          {current ? "Cambiar sueldo" : "Definir sueldo"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{current ? "Cambiar sueldo" : "Definir sueldo"}</DialogTitle>
          <DialogDescription>
            No se edita el anterior: se agrega uno nuevo que rige desde la fecha indicada.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="team_member_id" value={memberId} />
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <FormField label="Monto" htmlFor="salary-amount" error={errors.amount}>
              <Input
                id="salary-amount"
                name="amount"
                inputMode="decimal"
                defaultValue={current ? String(current.amount) : ""}
                className="h-11 tabular-nums md:h-9"
              />
            </FormField>
            <FormField label="Moneda" htmlFor="salary-currency" error={errors.currency}>
              <select
                id="salary-currency"
                name="currency"
                defaultValue={
                  current?.rateKind === "bcv_usd" ? "USD_BCV" : current?.rateKind === "bcv_eur" ? "EUR_BCV" : (current?.currency ?? "USD")
                }
                className="h-11 w-full min-w-0 rounded-md border bg-background px-2 text-sm md:h-9"
              >
                {SALARY_PAY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
            <FormField label="Frecuencia" htmlFor="salary-frequency" error={errors.frequency}>
              <select
                id="salary-frequency"
                name="frequency"
                defaultValue={current?.frequency ?? "biweekly"}
                className="h-11 w-full min-w-0 rounded-md border bg-background px-2 text-sm md:h-9"
              >
                {(Object.keys(FREQUENCY_LABELS) as SalaryFrequency[]).map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Rige desde" htmlFor="salary-from" error={errors.effective_from}>
              <DateField id="salary-from" name="effective_from" defaultValue={today} className="min-w-0" />
            </FormField>
          </div>
          <FormField label="Nota" htmlFor="salary-notes" error={errors.notes} optional>
            <Input id="salary-notes" name="notes" placeholder="Ej.: aumento de octubre" className="h-11 md:h-9" />
          </FormField>
          <SubmitButton pending={pending}>Guardar sueldo</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default SalaryAgreementDialog

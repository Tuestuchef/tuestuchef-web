"use client"

import { BanknoteIcon, HandCoinsIcon } from "lucide-react"
import { useMemo, useState } from "react"

import FormField from "@/common/components/form-field"
import ReceiptField from "@/common/components/receipt-field"
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
import type { Currency } from "@/common/lib/constants/currency.constants"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"
import { formatDate } from "@/common/lib/utils/format-date.util"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import BackdateField from "@/modules/sales/components/backdate-field"

import { registerPayrollAction } from "../lib/actions/team.action"
import { FREQUENCY_LABELS, type PayrollEntryKind } from "../lib/constants/team.constants"
import type { PayrollEntryItem, Salary } from "../lib/types/team.types"
import { formatSalary, type PayrollRates, salaryInUsd } from "../lib/utils/salary.util"

type PayrollDialogProps = {
  kind: PayrollEntryKind
  memberId: string
  memberName: string
  accounts: { id: string; name: string; currency: Currency }[]
  // Tasas de hoy: solo para sugerir el monto en la moneda de la cuenta.
  rates: PayrollRates | null
  today: string
  salary: Salary | null
  pendingAdvances: PayrollEntryItem[]
  receiptsEnabled: boolean
}

const round2 = (v: number) => Math.round(v * 100) / 100

// Moneda de la cuenta por 1 USD de referencia (Bs con BCV, igual que la base).
const unitsPerUsd = (currency: Currency, rates: PayrollDialogProps["rates"]) =>
  currency === "VES" ? (rates?.bcvUsd ?? 0) : currency === "USDT" ? (rates?.usdUsdt ?? 1) : 1

// Pago de sueldo (descuenta adelantos) o adelanto. Siempre a la persona del equipo, con categoría Sueldos.
const PayrollDialog = ({
  kind,
  memberId,
  memberName,
  accounts,
  rates,
  today,
  salary,
  pendingAdvances,
  receiptsEnabled,
}: PayrollDialogProps) => {
  const isPayment = kind === "payment"
  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "")
  const [settle, setSettle] = useState<Set<string>>(new Set(pendingAdvances.map((a) => a.id)))
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(today)
  const [uploading, setUploading] = useState(false)
  const { state, onSubmit, pending } = useFormAction(registerPayrollAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}

  const account = accounts.find((a) => a.id === accountId)
  // Sugerencia en USD: sueldo − adelantos marcados.
  const grossUsd = salary ? salaryInUsd(salary, rates) : 0
  const advancesUsd = useMemo(
    () => pendingAdvances.filter((a) => settle.has(a.id)).reduce((sum, a) => sum + a.usdAmount, 0),
    [pendingAdvances, settle]
  )
  const netUsd = Math.max(grossUsd - advancesUsd, 0)
  const suggested = account && isPayment && salary && rates ? round2(netUsd * unitsPerUsd(account.currency, rates)) : null

  const toggle = (id: string) =>
    setSettle((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next && suggested !== null) setAmount(String(suggested))
      }}
    >
      <DialogTrigger asChild>
        <Button variant={isPayment ? "default" : "outline"} className="h-11 md:h-9">
          {isPayment ? <BanknoteIcon aria-hidden /> : <HandCoinsIcon aria-hidden />}
          {isPayment ? "Pagar sueldo" : "Adelanto"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isPayment ? "Pago de sueldo" : "Adelanto"} · {memberName}
          </DialogTitle>
          <DialogDescription>
            {isPayment
              ? salary
                ? `Sueldo ${FREQUENCY_LABELS[salary.frequency].toLowerCase()}: ${formatSalary(salary)}. Se descuentan los adelantos marcados.`
                : "Sin sueldo definido: escribe el monto pagado."
              : "Queda pendiente y se descuenta en el próximo pago."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="team_member_id" value={memberId} />
          <input type="hidden" name="account_id" value={accountId} />
          {[...settle].map((id) => (
            <input key={id} type="hidden" name="settle_advance_ids" value={id} />
          ))}
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

          {isPayment && pendingAdvances.length > 0 && (
            <fieldset className="grid gap-2 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">Adelantos a descontar</legend>
              {pendingAdvances.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={settle.has(a.id)} onChange={() => toggle(a.id)} className="size-4" />
                  <span className="flex-1">{formatDate(a.occurredAt)}</span>
                  <span className="tabular-nums">
                    {formatMoney(a.amount, a.currency)}
                    {a.currency !== "USD" && <span className="text-xs text-muted-foreground"> ≈ {formatMoney(a.usdAmount, "USD")}</span>}
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          <FormField label="Sale de la cuenta" htmlFor="payroll-account" error={errors.account_id}>
            <select
              id="payroll-account"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value)
                const next = accounts.find((a) => a.id === e.target.value)
                if (next && isPayment && salary && rates) setAmount(String(round2(netUsd * unitsPerUsd(next.currency, rates))))
              }}
              className="h-11 rounded-md border bg-background px-2 text-sm md:h-9"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label={`Monto en ${account?.currency ?? ""}`}
            htmlFor="payroll-amount"
            error={errors.amount}
            hint={suggested !== null ? `Sugerido: ${formatMoney(suggested, account!.currency)} (sueldo − adelantos marcados).` : undefined}
          >
            <Input
              id="payroll-amount"
              name="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11 text-right tabular-nums md:h-9"
            />
          </FormField>

          {isPayment && (
            <FormField label="Período" htmlFor="payroll-period" error={errors.period_label} optional>
              <Input id="payroll-period" name="period_label" placeholder="Ej.: 1–15 oct" className="h-11 md:h-9" />
            </FormField>
          )}
          <FormField label="Nota" htmlFor="payroll-note" error={errors.note} optional>
            <Input id="payroll-note" name="note" className="h-11 md:h-9" />
          </FormField>

          <BackdateField
            id="payroll-date"
            name="date"
            today={today}
            maxDaysBack={null}
            value={date}
            onChange={(next) => setDate(next)}
          />
          <ReceiptField enabled={receiptsEnabled} onUploadingChange={setUploading} />

          <SubmitButton pending={pending} disabled={uploading}>
            {isPayment ? "Registrar pago" : "Registrar adelanto"}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default PayrollDialog

"use client"

import { BanknoteIcon } from "lucide-react"
import { useState } from "react"

import ChoiceChips from "@/common/components/choice-chips"
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
import { CURRENCY_LABELS } from "@/common/lib/constants/currency.constants"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"
import { formatMoney, formatRate } from "@/common/lib/utils/format-money.util"

import { addSalePaymentAction } from "../lib/actions/sale-operations.action"
import type { SaleFormData, SaleRatesForDate } from "../lib/types/sales.types"
import { unitsPerUsd, usdToMethodAmount } from "../lib/utils/sale-math.util"
import BackdateField from "./backdate-field"

type AddPaymentDialogProps = {
  saleId: string
  balanceUsd: number
  methods: SaleFormData["methods"]
  rates: SaleFormData["rates"]
  receiptsEnabled: boolean
  today: string
  // Staff: días máximos hacia atrás; null = sin límite.
  maxDaysBack: number | null
}

// Abono o pago del saldo. En Bs se convierte con la tasa de hoy (no la del día de la venta).
const AddPaymentDialog = ({
  saleId,
  balanceUsd,
  methods,
  rates,
  receiptsEnabled,
  today,
  maxDaysBack,
}: AddPaymentDialogProps) => {
  const [open, setOpen] = useState(false)
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "")
  const [amount, setAmount] = useState("")
  const [uploading, setUploading] = useState(false)
  const [date, setDate] = useState(today)
  const [dateRates, setDateRates] = useState<SaleRatesForDate | "today">("today")
  const isBackdated = date !== today
  const { state, onSubmit, pending } = useFormAction(addSalePaymentAction)
  useActionFeedback(state, () => setOpen(false))

  const method = methods.find((m) => m.id === methodId)
  const saleRates =
    dateRates === "today"
      ? (rates ?? { bcvUsd: 0, bcvEur: 0, usdUsdt: 1, isCurrent: false })
      : { bcvUsd: 0, bcvEur: 0, usdUsdt: 1, ...dateRates, isCurrent: dateRates !== null }
  const needsRate = method && method.rateKind !== "none"
  const blocked = isBackdated ? dateRates === null : Boolean(needsRate && !rates?.isCurrent)
  const fullAmount = method ? usdToMethodAmount(balanceUsd, method, saleRates) : 0

  const selectMethod = (id: string) => {
    setMethodId(id)
    const next = methods.find((m) => m.id === id)
    if (next) setAmount(String(usdToMethodAmount(balanceUsd, next, saleRates)))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setAmount(String(fullAmount))
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-11 md:h-9">
          <BanknoteIcon aria-hidden />
          Registrar pago
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>Saldo pendiente: {formatMoney(balanceUsd, "USD")}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="sale_id" value={saleId} />
          <input type="hidden" name="payment_method_id" value={methodId} />
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

          <FormField label="Método" htmlFor="payment-method" error={state.fieldErrors?.payment_method_id}>
            <ChoiceChips
              id="payment-method"
              label="Método"
              value={methodId}
              onChange={selectMethod}
              options={methods.map((m) => ({ value: m.id, label: m.name }))}
            />
          </FormField>

          <BackdateField
            id="payment-date"
            name="date"
            today={today}
            maxDaysBack={maxDaysBack}
            value={date}
            onChange={(next, nextRates) => {
              setDate(next)
              setDateRates(nextRates)
              if (method && nextRates !== null) {
                const r = nextRates === "today" ? (rates ?? saleRates) : { ...saleRates, ...nextRates }
                setAmount(String(usdToMethodAmount(balanceUsd, method, r)))
              }
            }}
          />

          {blocked ? (
            !isBackdated && <StatusAlert tone="warning" title="Falta la tasa BCV de hoy para cobrar en Bs." />
          ) : (
            <FormField
              label={`Monto en ${method ? CURRENCY_LABELS[method.currency].toLowerCase() : ""}`}
              htmlFor="payment-amount"
              error={state.fieldErrors?.amount}
              hint={
                needsRate && method
                  ? `Tasa ${isBackdated ? "de esa fecha" : "de hoy"}: ${formatRate(unitsPerUsd(method, saleRates))} · saldo completo = ${formatMoney(fullAmount, method.currency)}`
                  : undefined
              }
            >
              <Input
                id="payment-amount"
                name="amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11 text-right tabular-nums md:h-9"
              />
            </FormField>
          )}

          <ReceiptField enabled={receiptsEnabled} onUploadingChange={setUploading} />

          <SubmitButton pending={pending} disabled={uploading || blocked}>
            Registrar pago
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default AddPaymentDialog

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
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"
import { formatMoney, formatRate } from "@/common/lib/utils/format-money.util"
import BackdateField from "@/modules/sales/components/backdate-field"
import type { SaleRatesForDate } from "@/modules/sales/lib/types/sales.types"

import { addPurchasePaymentAction } from "../lib/actions/purchase-operations.action"
import { SUPPLIER_RATE_LABELS, type SupplierRateKind } from "../lib/constants/purchases.constants"
import type { PurchaseFormData } from "../lib/types/purchases.types"
import { unitsPerUsd, usdToAccountAmount } from "../lib/utils/purchase-math.util"

type AddPurchasePaymentDialogProps = {
  purchaseId: string
  balanceUsd: number
  accounts: PurchaseFormData["accounts"]
  rates: PurchaseFormData["rates"]
  today: string
  receiptsEnabled: boolean
}

// Abono a un proveedor (owner y admin). En Bs se elige BCV o paralelo, de la fecha del pago.
const AddPurchasePaymentDialog = ({
  purchaseId,
  balanceUsd,
  accounts,
  rates,
  today,
  receiptsEnabled,
}: AddPurchasePaymentDialogProps) => {
  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "")
  const [rateKind, setRateKind] = useState<SupplierRateKind>("bcv_usd")
  const [amount, setAmount] = useState("")
  const [uploading, setUploading] = useState(false)
  const [date, setDate] = useState(today)
  const [dateRates, setDateRates] = useState<SaleRatesForDate | "today">("today")
  const { state, onSubmit, pending } = useFormAction(addPurchasePaymentAction)
  useActionFeedback(state, () => setOpen(false))

  const account = accounts.find((a) => a.id === accountId)
  const isBackdated = date !== today
  const effective =
    dateRates === "today" ? rates : dateRates ? { bcvUsd: dateRates.bcvUsd, binance: dateRates.binance, usdUsdt: dateRates.usdUsdt } : null
  const missingRate = isBackdated ? dateRates === null : account?.currency === "VES" && !rates?.isCurrent
  const kind: SupplierRateKind = account?.currency === "VES" ? rateKind : "none"

  const suggest = (nextAccountId = accountId, nextKind = rateKind, nextRates = effective) => {
    const next = accounts.find((a) => a.id === nextAccountId)
    if (next && nextRates) setAmount(String(usdToAccountAmount(balanceUsd, next.currency, next.currency === "VES" ? nextKind : "none", nextRates)))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) suggest()
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
          <DialogTitle>Pago al proveedor</DialogTitle>
          <DialogDescription>Saldo pendiente: {formatMoney(balanceUsd, "USD")}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="purchase_id" value={purchaseId} />
          <input type="hidden" name="account_id" value={accountId} />
          <input type="hidden" name="rate_kind" value={kind} />
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

          <FormField label="Sale de la cuenta" htmlFor="pp-account" error={state.fieldErrors?.account_id}>
            <select
              id="pp-account"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value)
                suggest(e.target.value)
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

          {account?.currency === "VES" && (
            <FormField label="Tasa del pago en Bs" htmlFor="pp-rate">
              <ChoiceChips
                id="pp-rate"
                label="Tasa del pago en Bs"
                value={rateKind}
                onChange={(v) => {
                  setRateKind(v as SupplierRateKind)
                  suggest(accountId, v as SupplierRateKind)
                }}
                options={[
                  { value: "bcv_usd", label: SUPPLIER_RATE_LABELS.bcv_usd },
                  { value: "parallel", label: SUPPLIER_RATE_LABELS.parallel },
                ]}
              />
            </FormField>
          )}

          <BackdateField
            id="pp-date"
            name="date"
            today={today}
            maxDaysBack={null}
            value={date}
            onChange={(next, nextRates) => {
              setDate(next)
              setDateRates(nextRates)
              suggest(
                accountId,
                rateKind,
                nextRates === "today" ? rates : nextRates ? { bcvUsd: nextRates.bcvUsd, binance: nextRates.binance, usdUsdt: nextRates.usdUsdt } : null
              )
            }}
          />

          {missingRate && !isBackdated ? (
            <StatusAlert tone="warning" title="Falta la tasa de hoy para pagar en Bs." />
          ) : (
            <FormField
              label={`Monto en ${account?.currency ?? ""}`}
              htmlFor="pp-amount"
              error={state.fieldErrors?.amount}
              hint={
                account?.currency === "VES" && effective
                  ? `Tasa: ${formatRate(unitsPerUsd("VES", rateKind, effective))} · el valor real se calcula con Binance`
                  : undefined
              }
            >
              <Input
                id="pp-amount"
                name="amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11 text-right tabular-nums md:h-9"
              />
            </FormField>
          )}

          <ReceiptField enabled={receiptsEnabled} onUploadingChange={setUploading} />

          <SubmitButton pending={pending} disabled={uploading || missingRate}>
            Registrar pago
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default AddPurchasePaymentDialog

"use client"

import { useState } from "react"

import DateField from "@/common/components/date-field"
import FormField from "@/common/components/form-field"
import ReceiptField from "@/common/components/receipt-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Input } from "@/common/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/common/components/ui/select"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"
import { toCaracasDate } from "@/common/lib/utils/format-date.util"
import { formatMoney, formatRate, formatUsdt } from "@/common/lib/utils/format-money.util"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"
import { fromUsdt, toUsdt } from "@/common/lib/utils/to-usdt.util"

import { createAccountTransferAction } from "../lib/actions/create-account-transfer.action"
import type { Account, ExchangeRate } from "../lib/types/treasury.types"

type TransferFormProps = {
  accounts: Account[]
  rate: ExchangeRate
  receiptsEnabled: boolean
}

const round2 = (value: number) => Math.round(value * 100) / 100

const TransferForm = ({ accounts, rate, receiptsEnabled }: TransferFormProps) => {
  const { state, onSubmit, pending } = useFormAction(createAccountTransferAction)
  const errors = state.fieldErrors ?? {}

  const [fromId, setFromId] = useState("")
  const [toId, setToId] = useState("")
  const [amountOut, setAmountOut] = useState("")
  const [amountIn, setAmountIn] = useState("")
  const [binanceRate, setBinanceRate] = useState("")
  const [usdUsdtRate, setUsdUsdtRate] = useState("")
  const [uploading, setUploading] = useState(false)

  const from = accounts.find((a) => a.id === fromId)
  const to = accounts.find((a) => a.id === toId)
  const rates = {
    binanceRate: parseAmount(binanceRate, 8) ?? Number(rate.binance_usdt),
    usdUsdtRate: parseAmount(usdUsdtRate, 8) ?? Number(rate.usd_usdt),
  }

  // Misma cuenta que hace la base: lo que llega define el traspaso; la diferencia es comisión.
  const out = parseAmount(amountOut)
  const incoming = parseAmount(amountIn)
  let preview: { fee: number; feeUsdt: number; effectiveRate: string | null } | null = null
  if (from && to && out && incoming) {
    const portion =
      from.currency === to.currency
        ? incoming
        : round2(fromUsdt(toUsdt(incoming, to.currency, rates), from.currency, rates))
    const fee = round2(out - portion)
    preview = {
      fee,
      feeUsdt: toUsdt(fee, from.currency, rates),
      effectiveRate:
        from.currency !== to.currency ? `${formatRate(out / incoming)} ${from.currency} por ${to.currency}` : null,
    }
  }

  const today = toCaracasDate()

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Sale de" htmlFor="transfer-from" error={errors.from_account_id}>
          <Select name="from_account_id" value={fromId} onValueChange={setFromId}>
            <SelectTrigger id="transfer-from" className="h-11 w-full md:h-9">
              <SelectValue placeholder="Cuenta de origen" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Llega a" htmlFor="transfer-to" error={errors.to_account_id}>
          <Select name="to_account_id" value={toId} onValueChange={setToId}>
            <SelectTrigger id="transfer-to" className="h-11 w-full md:h-9">
              <SelectValue placeholder="Cuenta de destino" />
            </SelectTrigger>
            <SelectContent>
              {accounts
                .filter((account) => account.id !== fromId)
                .map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label={`Sale${from ? ` (${from.currency})` : ""}`}
          htmlFor="transfer-out"
          error={errors.amount_out}
        >
          <Input
            id="transfer-out"
            name="amount_out"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={amountOut}
            onChange={(e) => setAmountOut(e.target.value)}
            className="h-11 text-base md:h-9"
          />
        </FormField>
        <FormField
          label={`Llega${to ? ` (${to.currency})` : ""}`}
          htmlFor="transfer-in"
          error={errors.amount_in}
          hint="Lo que realmente entró, ya descontadas las comisiones."
        >
          <Input
            id="transfer-in"
            name="amount_in"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            className="h-11 text-base md:h-9"
          />
        </FormField>
      </div>

      {preview && from && (
        <StatusAlert
          tone={preview.fee > 0 ? "warning" : "info"}
          title={
            preview.fee > 0
              ? `Comisión de cambio: ${formatMoney(preview.fee, from.currency)} (≈ ${formatUsdt(preview.feeUsdt)})`
              : preview.fee < 0
                ? `Ganancia cambiaria: ${formatMoney(-preview.fee, from.currency)} (≈ ${formatUsdt(-preview.feeUsdt)})`
                : "Sin comisión"
          }
        >
          {preview.effectiveRate && <>Tasa efectiva: {preview.effectiveRate}.</>} La comisión queda registrada
          aparte, en la categoría “Comisión de cambio”.
        </StatusAlert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Fecha" htmlFor="transfer-date" error={errors.date} hint="Vacía = hoy">
          <DateField id="transfer-date" name="date" max={today} placeholder="Hoy" clearable />
        </FormField>
        <FormField label="Nota" htmlFor="transfer-note" error={errors.note} optional>
          <Input id="transfer-note" name="note" className="h-11 md:h-9" />
        </FormField>
      </div>

      <details className="rounded-lg border px-3 py-2 text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Tasas de esta operación (por defecto, las del día)
        </summary>
        <div className="grid gap-4 pt-3 sm:grid-cols-3">
          <FormField label="Binance" htmlFor="transfer-binance" error={errors.binance_rate}>
            <Input
              id="transfer-binance"
              name="binance_rate"
              inputMode="decimal"
              placeholder={formatRate(Number(rate.binance_usdt))}
              value={binanceRate}
              onChange={(e) => setBinanceRate(e.target.value)}
              className="h-11 md:h-9"
            />
          </FormField>
          <FormField label="BCV dólar" htmlFor="transfer-bcv" error={errors.bcv_usd_rate}>
            <Input
              id="transfer-bcv"
              name="bcv_usd_rate"
              inputMode="decimal"
              placeholder={formatRate(Number(rate.bcv_usd))}
              className="h-11 md:h-9"
            />
          </FormField>
          <FormField label="USD → USDT" htmlFor="transfer-usd-usdt" error={errors.usd_usdt_rate}>
            <Input
              id="transfer-usd-usdt"
              name="usd_usdt_rate"
              inputMode="decimal"
              placeholder={formatRate(Number(rate.usd_usdt))}
              value={usdUsdtRate}
              onChange={(e) => setUsdUsdtRate(e.target.value)}
              className="h-11 md:h-9"
            />
          </FormField>
        </div>
      </details>

      <div className="grid gap-2">
        <ReceiptField enabled={receiptsEnabled} onUploadingChange={setUploading} />
        {errors.receipt_path && <StatusAlert tone="error" title={errors.receipt_path[0]} />}
      </div>

      <SubmitButton pending={pending} disabled={uploading}>
        Registrar traspaso
      </SubmitButton>
    </form>
  )
}

export default TransferForm

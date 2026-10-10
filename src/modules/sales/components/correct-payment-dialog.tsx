"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import ChoiceChips from "@/common/components/choice-chips"
import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/common/components/ui/dialog"
import { Input } from "@/common/components/ui/input"
import { Textarea } from "@/common/components/ui/textarea"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"

import { correctPaymentAction } from "../lib/actions/sale-operations.action"
import type { SaleDetailPayment, SalePaymentMethod } from "../lib/types/sales.types"

type Mode = "replace" | "remove"

// Corregir un pago mal registrado (owner y admin): otro método u otro monto, o quitarlo.
// El pago se revierte en su cuenta con su misma fecha y el correcto entra con esa fecha.
const CorrectPaymentDialog = ({ payment, methods }: { payment: SaleDetailPayment; methods: SalePaymentMethod[] }) => {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("replace")
  const [methodId, setMethodId] = useState(payment.methodId)
  const [amount, setAmount] = useState(String(payment.amount))
  const [reason, setReason] = useState("")
  const method = methods.find((m) => m.id === methodId)

  const reset = () => {
    setMode("replace")
    setMethodId(payment.methodId)
    setAmount(String(payment.amount))
    setReason("")
    setError(null)
  }

  // Al cambiar a un método de otra moneda, el monto se vuelve a escribir.
  const changeMethod = (id: string) => {
    const next = methods.find((m) => m.id === id)
    if (next && next.currency !== method?.currency) setAmount(next.currency === payment.currency ? String(payment.amount) : "")
    setMethodId(id)
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    const parsed = parseAmount(amount)
    if (mode === "replace" && (!parsed || parsed <= 0)) {
      setError("Indica el monto.")
      return
    }
    startTransition(async () => {
      const result = await correctPaymentAction({
        payment_id: payment.id,
        payment_method_id: mode === "replace" ? methodId : null,
        amount: mode === "replace" ? parsed : null,
        reason,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(result.message)
      setOpen(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset()
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
          Corregir
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Corregir pago</DialogTitle>
          <DialogDescription>
            {payment.methodName} · {formatMoney(payment.amount, payment.currency)}. Se revierte en su cuenta con la misma
            fecha y entra el correcto, con las tasas de ese día.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <ChoiceChips
            label="Qué pasó"
            value={mode}
            onChange={(v) => setMode(v as Mode)}
            options={[
              { value: "replace", label: "Otro método o monto" },
              { value: "remove", label: "No pagó: quitarlo" },
            ]}
          />
          {mode === "replace" ? (
            <>
              <FormField label="Método correcto" htmlFor="correct-method">
                <ChoiceChips
                  id="correct-method"
                  label="Método correcto"
                  value={methodId}
                  onChange={changeMethod}
                  options={methods.map((m) => ({ value: m.id, label: m.name }))}
                />
              </FormField>
              <FormField label={`Monto (${method?.currency ?? ""})`} htmlFor="correct-amount">
                <Input
                  id="correct-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-11 text-right tabular-nums md:h-9"
                />
              </FormField>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">La venta queda con ese monto por cobrar.</p>
          )}
          <FormField label="Motivo" htmlFor="correct-reason" hint="Queda en el historial de la venta, con tu nombre.">
            <Textarea
              id="correct-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: pagó por Zelle, no en efectivo"
            />
          </FormField>
          {error && <StatusAlert tone="error" title={error} />}
          <DialogFooter>
            <SubmitButton pending={pending} pendingLabel="Guardando…" disabled={reason.trim().length < 3}>
              {mode === "replace" ? "Corregir pago" : "Quitar pago"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CorrectPaymentDialog

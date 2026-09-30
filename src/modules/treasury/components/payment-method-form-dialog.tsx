"use client"

import { PencilIcon, PlusIcon } from "lucide-react"
import { useState } from "react"

import ActiveSwitchField from "@/common/components/active-switch-field"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/common/components/ui/select"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { savePaymentMethodAction } from "../lib/actions/save-payment-method.action"
import { type PaymentRateKind, RATE_KIND_LABELS } from "../lib/constants/treasury.constants"
import type { Account, PaymentMethod } from "../lib/types/treasury.types"

type PaymentMethodFormDialogProps = {
  accounts: Account[]
  paymentMethod?: PaymentMethod
}

const PaymentMethodFormDialog = ({ accounts, paymentMethod }: PaymentMethodFormDialogProps) => {
  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState(paymentMethod?.account_id ?? "")
  const [rateKind, setRateKind] = useState<PaymentRateKind>(
    paymentMethod?.rate_kind && paymentMethod.rate_kind !== "none" ? paymentMethod.rate_kind : "bcv_usd"
  )
  const { state, onSubmit, pending } = useFormAction(savePaymentMethodAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}
  const isEdit = Boolean(paymentMethod)
  const selectableAccounts = accounts.filter((a) => a.is_active || a.id === paymentMethod?.account_id)
  const chargesInBs = accounts.find((a) => a.id === accountId)?.currency === "VES"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" aria-label={`Editar ${paymentMethod!.name}`}>
            <PencilIcon />
          </Button>
        ) : (
          <Button className="h-11 md:h-9">
            <PlusIcon aria-hidden />
            Nuevo método
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar método de pago" : "Nuevo método de pago"}</DialogTitle>
          <DialogDescription>
            Cada producto tiene un precio en USD por método de pago. Si cobra en Bs, se convierte con la tasa BCV del día.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {paymentMethod && <input type="hidden" name="id" value={paymentMethod.id} />}
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

          <FormField label="Nombre" htmlFor="pm-name" error={errors.name}>
            <Input
              id="pm-name"
              name="name"
              defaultValue={paymentMethod?.name}
              placeholder="Pago móvil, Zelle, USDT…"
              className="h-11 md:h-9"
            />
          </FormField>

          <FormField label="Cuenta donde cae el dinero" htmlFor="pm-account" error={errors.account_id}>
            <Select name="account_id" value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="pm-account" className="h-11 w-full md:h-9">
                <SelectValue placeholder="Elige la cuenta" />
              </SelectTrigger>
              <SelectContent>
                {selectableAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {chargesInBs ? (
            <FormField
              label="Tasa para cobrar en Bs"
              htmlFor="pm-rate"
              error={errors.rate_kind}
              hint="Monto en Bs = precio en USD × esta tasa del día."
            >
              <Select name="rate_kind" value={rateKind} onValueChange={(v) => setRateKind(v as PaymentRateKind)}>
                <SelectTrigger id="pm-rate" className="h-11 w-full md:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bcv_usd">{RATE_KIND_LABELS.bcv_usd}</SelectItem>
                  <SelectItem value="bcv_eur">{RATE_KIND_LABELS.bcv_eur}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          ) : (
            <input type="hidden" name="rate_kind" value="none" />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Orden" htmlFor="pm-order" error={errors.sort_order} hint="Menor aparece primero.">
              <Input
                id="pm-order"
                name="sort_order"
                type="number"
                min={0}
                inputMode="numeric"
                defaultValue={paymentMethod?.sort_order ?? 0}
                className="h-11 md:h-9"
              />
            </FormField>
          </div>

          <ActiveSwitchField defaultChecked={paymentMethod?.is_active ?? true} label="Método activo" />

          <SubmitButton pending={pending}>{isEdit ? "Guardar cambios" : "Crear método"}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default PaymentMethodFormDialog

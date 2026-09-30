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
import { CURRENCY_LABELS, type Currency } from "@/common/lib/constants/currency.constants"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { savePaymentMethodAction } from "../lib/actions/save-payment-method.action"
import type { Account, PaymentMethod } from "../lib/types/treasury.types"

type PaymentMethodFormDialogProps = {
  accounts: Account[]
  paymentMethod?: PaymentMethod
}

const PaymentMethodFormDialog = ({ accounts, paymentMethod }: PaymentMethodFormDialogProps) => {
  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState(paymentMethod?.account_id ?? "")
  const [priceCurrency, setPriceCurrency] = useState<string>(paymentMethod?.price_currency ?? "")
  const { state, onSubmit, pending } = useFormAction(savePaymentMethodAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}
  const isEdit = Boolean(paymentMethod)
  const selectableAccounts = accounts.filter((a) => a.is_active || a.id === paymentMethod?.account_id)

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
            Cada producto podrá tener un precio distinto por método de pago.
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

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Moneda de los precios"
              htmlFor="pm-currency"
              error={errors.price_currency}
              hint="Ej.: pago móvil con precios en USD que se cobran en Bs."
            >
              <Select name="price_currency" value={priceCurrency} onValueChange={setPriceCurrency}>
                <SelectTrigger id="pm-currency" className="h-11 w-full md:h-9">
                  <SelectValue placeholder="Elige la moneda" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CURRENCY_LABELS) as Currency[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {CURRENCY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
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

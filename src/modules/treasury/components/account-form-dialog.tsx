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
import { CURRENCY_LABELS } from "@/common/lib/constants/currency.constants"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { saveAccountAction } from "../lib/actions/save-account.action"
import {
  ACCOUNT_KIND_CURRENCIES,
  ACCOUNT_KIND_LABELS,
  type AccountKind,
} from "../lib/constants/treasury.constants"
import type { Account } from "../lib/types/treasury.types"

type AccountFormDialogProps = {
  account?: Account
}

const AccountFormDialog = ({ account }: AccountFormDialogProps) => {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<AccountKind | "">(account?.kind ?? "")
  const [currency, setCurrency] = useState<string>(account?.currency ?? "")
  const { state, onSubmit, pending } = useFormAction(saveAccountAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}
  const isEdit = Boolean(account)
  const currencies = kind ? ACCOUNT_KIND_CURRENCIES[kind] : []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" aria-label={`Editar ${account!.name}`}>
            <PencilIcon />
          </Button>
        ) : (
          <Button className="h-11 md:h-9">
            <PlusIcon aria-hidden />
            Nueva cuenta
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "La moneda no se puede cambiar. Si ya no usas la cuenta, desactívala: su historial se conserva."
              : "El saldo sale de los movimientos; no se escribe a mano."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {account && <input type="hidden" name="id" value={account.id} />}
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

          <FormField label="Nombre" htmlFor="account-name" error={errors.name}>
            <Input
              id="account-name"
              name="name"
              defaultValue={account?.name}
              placeholder="Banesco Bs, Binance, Caja USD…"
              className="h-11 md:h-9"
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Tipo" htmlFor="account-kind" error={errors.kind}>
              <Select
                name="kind"
                value={kind}
                onValueChange={(value: AccountKind) => {
                  setKind(value)
                  if (!isEdit) setCurrency(ACCOUNT_KIND_CURRENCIES[value][0])
                }}
              >
                <SelectTrigger id="account-kind" className="h-11 w-full md:h-9">
                  <SelectValue placeholder="Elige el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ACCOUNT_KIND_LABELS) as AccountKind[])
                    .filter((value) => !isEdit || ACCOUNT_KIND_CURRENCIES[value].includes(account!.currency))
                    .map((value) => (
                      <SelectItem key={value} value={value}>
                        {ACCOUNT_KIND_LABELS[value]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Moneda" htmlFor="account-currency" error={errors.currency}>
              {isEdit ? (
                <Input id="account-currency" value={CURRENCY_LABELS[account!.currency]} disabled className="h-11 md:h-9" />
              ) : (
                <Select name="currency" value={currency} onValueChange={setCurrency} disabled={!kind}>
                  <SelectTrigger id="account-currency" className="h-11 w-full md:h-9">
                    <SelectValue placeholder="Elige primero el tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((value) => (
                      <SelectItem key={value} value={value}>
                        {CURRENCY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </div>

          <FormField label="Notas" htmlFor="account-notes" error={errors.notes} optional>
            <Input
              id="account-notes"
              name="notes"
              defaultValue={account?.notes ?? ""}
              placeholder="Titular, últimos dígitos…"
              className="h-11 md:h-9"
            />
          </FormField>

          {account && (
            <ActiveSwitchField
              defaultChecked={account.is_active}
              label="Cuenta activa"
              description="Una cuenta inactiva no recibe movimientos nuevos."
            />
          )}

          <SubmitButton pending={pending}>{isEdit ? "Guardar cambios" : "Crear cuenta"}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default AccountFormDialog

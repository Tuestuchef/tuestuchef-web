"use client"

import { Settings2Icon } from "lucide-react"
import { useState } from "react"

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

import { saveProfitPolicyAction } from "../lib/actions/profit-policy.action"
import type { ProfitPolicy } from "../lib/types/analytics.types"

type ProfitPolicyDialogProps = {
  policy: ProfitPolicy
  // Solo cuentas en USDT pueden ser la reserva.
  usdtAccounts: { id: string; name: string }[]
}

// Cuánto de la utilidad se aparta para reserva y reinversión, y a qué cuenta va la reserva.
const ProfitPolicyDialog = ({ policy, usdtAccounts }: ProfitPolicyDialogProps) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(saveProfitPolicyAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2Icon aria-hidden />
          Política
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Política de la utilidad</DialogTitle>
          <DialogDescription>
            Qué parte de la utilidad real se aparta. No se resta antes de calcularla: se compara con lo que de verdad se
            transfirió a la reserva y lo que se gastó en reinversión.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          <FormField
            label="Cuenta de reserva (USDT)"
            htmlFor="policy-account"
            error={errors.reserve_account_id}
            hint={usdtAccounts.length === 0 ? "Crea una cuenta en USDT (p. ej. “Reserva”) en Configuración → Cuentas." : undefined}
          >
            <select
              id="policy-account"
              name="reserve_account_id"
              defaultValue={policy.reserveAccountId ?? "none"}
              className="h-11 rounded-md border bg-background px-2 text-sm md:h-9"
            >
              <option value="none">Sin cuenta de reserva</option>
              {usdtAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Reserva (%)" htmlFor="policy-reserve" error={errors.reserve_percent}>
              <Input
                id="policy-reserve"
                name="reserve_percent"
                type="number"
                min={0}
                max={100}
                step="0.5"
                defaultValue={String(policy.reservePercent)}
                className="h-11 md:h-9"
              />
            </FormField>
            <FormField label="Reinversión (%)" htmlFor="policy-reinvest" error={errors.reinvestment_percent}>
              <Input
                id="policy-reinvest"
                name="reinvestment_percent"
                type="number"
                min={0}
                max={100}
                step="0.5"
                defaultValue={String(policy.reinvestmentPercent)}
                className="h-11 md:h-9"
              />
            </FormField>
          </div>
          <SubmitButton pending={pending}>Guardar política</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default ProfitPolicyDialog

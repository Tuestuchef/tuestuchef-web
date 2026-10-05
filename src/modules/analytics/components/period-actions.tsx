"use client"

import { LockIcon, LockOpenIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

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
import { Textarea } from "@/common/components/ui/textarea"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { closePeriodAction, reopenPeriodAction } from "../lib/actions/period-close.action"

// Cerrar un mes: se confirma, porque después nadie registra con esa fecha.
export const ClosePeriodButton = ({ month, label }: { month: string; label: string }) => {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <LockIcon aria-hidden />
          Cerrar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar {label}</DialogTitle>
          <DialogDescription>
            Nadie podrá registrar nada con fecha de ese mes: ventas, pagos, compras, movimientos ni stock. Se guarda la
            utilidad del mes tal como está. Solo el owner puede reabrirlo.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            className="h-11 md:h-9"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await closePeriodAction(month)
                if (result.ok) {
                  toast.success(result.message)
                  setOpen(false)
                } else toast.error(result.error)
              })
            }
          >
            Cerrar el mes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Reabrir un mes cerrado: solo el owner, con motivo.
export const ReopenPeriodDialog = ({ month, label }: { month: string; label: string }) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(reopenPeriodAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <LockOpenIcon aria-hidden />
          Reabrir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reabrir {label}</DialogTitle>
          <DialogDescription>Queda registrado quién lo reabrió y por qué. Ciérralo de nuevo al terminar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="month" value={month} />
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          <FormField label="Motivo" htmlFor="rp-reason" error={errors.reason}>
            <Textarea id="rp-reason" name="reason" rows={2} />
          </FormField>
          <SubmitButton pending={pending}>Reabrir</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

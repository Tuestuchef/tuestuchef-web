"use client"

import { LockIcon, LockOpenIcon } from "lucide-react"
import { useState } from "react"

import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/common/components/ui/dialog"
import { Textarea } from "@/common/components/ui/textarea"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { customerBlockAction } from "../lib/actions/customer-block.action"

// Bloquear o desbloquear un cliente (owner y admin), siempre con motivo.
const CustomerBlockDialog = ({ customerId, blocked }: { customerId: string; blocked: boolean }) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(customerBlockAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 md:h-9">
          {blocked ? <LockOpenIcon aria-hidden /> : <LockIcon aria-hidden />}
          {blocked ? "Desbloquear" : "Bloquear"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{blocked ? "Desbloquear cliente" : "Bloquear cliente"}</DialogTitle>
          <DialogDescription>
            {blocked
              ? "Se le podrá vender de nuevo. Queda registrado quién y por qué."
              : "No se le podrá vender, ni en el panel ni en la tienda. Queda registrado quién y por qué."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="customer_id" value={customerId} />
          <input type="hidden" name="action" value={blocked ? "unblock" : "block"} />
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          <FormField label="Motivo" htmlFor="cb-reason" error={errors.reason}>
            <Textarea id="cb-reason" name="reason" rows={2} />
          </FormField>
          <SubmitButton pending={pending}>{blocked ? "Desbloquear" : "Bloquear"}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CustomerBlockDialog

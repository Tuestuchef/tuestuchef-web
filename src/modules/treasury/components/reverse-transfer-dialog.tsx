"use client"

import { useState } from "react"

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

import { reverseAccountTransferAction } from "../lib/actions/reverse-account-transfer.action"

type ReverseTransferDialogProps = {
  transferId: string
  description: string
}

const ReverseTransferDialog = ({ transferId, description }: ReverseTransferDialogProps) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(reverseAccountTransferAction)
  useActionFeedback(state, () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Anular
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular traspaso</DialogTitle>
          <DialogDescription>
            {description}. Se registran reversos de todas sus filas (salida, comisión y entrada); nada se
            borra.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="transfer_id" value={transferId} />
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          <FormField label="Motivo" htmlFor={`reason-${transferId}`} error={state.fieldErrors?.reason}>
            <Textarea id={`reason-${transferId}`} name="reason" rows={3} required />
          </FormField>
          <DialogFooter>
            <SubmitButton pending={pending} pendingLabel="Anulando…">
              Anular traspaso
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default ReverseTransferDialog

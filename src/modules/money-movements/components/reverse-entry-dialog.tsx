"use client"

import { Undo2Icon } from "lucide-react"
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

import { reverseLedgerEntryAction } from "../lib/actions/reverse-ledger-entry.action"

type ReverseEntryDialogProps = {
  entryId: string
  summary: string
}

const ReverseEntryDialog = ({ entryId, summary }: ReverseEntryDialogProps) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(reverseLedgerEntryAction)
  useActionFeedback(state, () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Revertir movimiento">
          <Undo2Icon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revertir movimiento</DialogTitle>
          <DialogDescription>
            {summary}. Se registra un movimiento opuesto con la misma fecha y tasas; el original no se borra.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="entry_id" value={entryId} />
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          <FormField label="Motivo" htmlFor={`reverse-${entryId}`} error={state.fieldErrors?.reason}>
            <Textarea id={`reverse-${entryId}`} name="reason" rows={3} placeholder="Ej.: monto equivocado" />
          </FormField>
          <DialogFooter>
            <SubmitButton pending={pending} pendingLabel="Revirtiendo…">
              Revertir
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default ReverseEntryDialog

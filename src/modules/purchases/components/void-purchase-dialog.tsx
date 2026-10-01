"use client"

import { BanIcon } from "lucide-react"
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

import { voidPurchaseAction } from "../lib/actions/purchase-operations.action"

// Anular (owner y admin): revierte los pagos y saca del stock lo que entró.
const VoidPurchaseDialog = ({ purchaseId, label }: { purchaseId: string; label: string }) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(voidPurchaseAction)
  useActionFeedback(state, () => setOpen(false))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 md:h-9">
          <BanIcon aria-hidden />
          Anular
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular {label}</DialogTitle>
          <DialogDescription>
            Se revierten los pagos en el libro y sale del inventario lo que entró. Si parte de la mercancía ya se vendió o
            se usó, no se puede anular: corrige con un ajuste.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="purchase_id" value={purchaseId} />
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          <FormField label="Motivo" htmlFor="void-purchase-reason" error={state.fieldErrors?.reason}>
            <Textarea id="void-purchase-reason" name="reason" rows={3} placeholder="Ej.: factura duplicada" />
          </FormField>
          <DialogFooter>
            <SubmitButton pending={pending} pendingLabel="Anulando…" variant="destructive">
              Anular compra
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default VoidPurchaseDialog

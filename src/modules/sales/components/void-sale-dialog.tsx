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

import { voidSaleAction } from "../lib/actions/sale-operations.action"

// Anular (owner y admin): revierte los pagos en el libro y devuelve el stock.
const VoidSaleDialog = ({ saleId, label }: { saleId: string; label: string }) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(voidSaleAction)
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
            Se revierten todos los pagos en el libro y vuelve al inventario lo que salió. La venta no se borra: queda
            marcada como anulada.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="sale_id" value={saleId} />
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          <FormField label="Motivo" htmlFor="void-reason" error={state.fieldErrors?.reason}>
            <Textarea id="void-reason" name="reason" rows={3} placeholder="Ej.: el cliente devolvió la mercancía" />
          </FormField>
          <DialogFooter>
            <SubmitButton pending={pending} pendingLabel="Anulando…" variant="destructive">
              Anular venta
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default VoidSaleDialog

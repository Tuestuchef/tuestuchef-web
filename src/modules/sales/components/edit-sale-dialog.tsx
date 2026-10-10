"use client"

import { PencilIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import ChoiceChips from "@/common/components/choice-chips"
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
import { Label } from "@/common/components/ui/label"
import { Textarea } from "@/common/components/ui/textarea"
import CustomerPicker, { type PickedCustomer } from "@/modules/customers/components/customer-picker"

import { editSaleAction } from "../lib/actions/sale-operations.action"
import {
  CHANNEL_LABELS,
  chargesShipping,
  DELIVERY_LABELS,
  DELIVERY_METHODS,
  type DeliveryMethod,
  MANUAL_CHANNELS,
  type SaleChannel,
} from "../lib/constants/sales.constants"

type EditSaleDialogProps = {
  saleId: string
  label: string
  customer: PickedCustomer | null
  channel: SaleChannel
  deliveryMethod: DeliveryMethod
  notes: string | null
  // Un pedido no puede quedar sin cliente; con cobro de delivery no puede quedar como retiro.
  isOrder: boolean
  hasDeliveryFee: boolean
}

// Editar los datos de una venta (owner y admin). Productos, precios y pagos no se cambian aquí.
const EditSaleDialog = (props: EditSaleDialogProps) => {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [customer, setCustomer] = useState(props.customer)
  const [channel, setChannel] = useState(props.channel)
  const [deliveryMethod, setDeliveryMethod] = useState(props.deliveryMethod)
  const [notes, setNotes] = useState(props.notes ?? "")
  const [reason, setReason] = useState("")

  // La venta en línea conserva su canal; las demás eligen entre los manuales.
  const channels = MANUAL_CHANNELS.includes(props.channel) ? MANUAL_CHANNELS : [props.channel, ...MANUAL_CHANNELS]

  const reset = () => {
    setCustomer(props.customer)
    setChannel(props.channel)
    setDeliveryMethod(props.deliveryMethod)
    setNotes(props.notes ?? "")
    setReason("")
    setError(null)
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await editSaleAction({
        sale_id: props.saleId,
        customer_id: customer?.id ?? null,
        channel,
        delivery_method: deliveryMethod,
        notes: notes.trim() || null,
        reason,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(result.message)
      setOpen(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset()
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 md:h-9">
          <PencilIcon aria-hidden />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar {props.label}</DialogTitle>
          <DialogDescription>
            Cliente, canal, entrega y notas. Para un pago, usa Corregir en el pago. Productos y precios no se editan: anula
            la venta y regístrala de nuevo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-2">
            <Label>Cliente</Label>
            <CustomerPicker
              value={customer}
              onChange={setCustomer}
              canManage
              emptyLabel={props.isOrder ? "Elige el cliente" : "Sin cliente (venta rápida)"}
            />
            {customer?.blockedReason && (
              <StatusAlert tone="warning" title={`Cliente bloqueado: no se le puede vender (${customer.blockedReason}).`} />
            )}
          </div>
          <FormField label="Canal" htmlFor="edit-channel">
            <ChoiceChips
              id="edit-channel"
              label="Canal"
              value={channel}
              onChange={(v) => setChannel(v as SaleChannel)}
              options={channels.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))}
            />
          </FormField>
          <FormField
            label="Entrega"
            htmlFor="edit-delivery"
            hint={props.hasDeliveryFee ? "La venta cobró delivery: no puede quedar como retiro." : undefined}
          >
            <ChoiceChips
              id="edit-delivery"
              label="Entrega"
              value={deliveryMethod}
              onChange={(v) => setDeliveryMethod(v as DeliveryMethod)}
              options={DELIVERY_METHODS.filter((d) => !props.hasDeliveryFee || chargesShipping(d)).map((d) => ({
                value: d,
                label: DELIVERY_LABELS[d],
              }))}
            />
          </FormField>
          <FormField label="Notas" htmlFor="edit-notes" optional>
            <Textarea id="edit-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </FormField>
          <FormField label="Motivo del cambio" htmlFor="edit-reason" hint="Queda en el historial de la venta, con tu nombre.">
            <Textarea
              id="edit-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: se olvidó agregar el cliente"
            />
          </FormField>
          {error && <StatusAlert tone="error" title={error} />}
          <DialogFooter>
            <SubmitButton pending={pending} pendingLabel="Guardando…" disabled={reason.trim().length < 3 || (props.isOrder && !customer)}>
              Guardar cambios
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default EditSaleDialog

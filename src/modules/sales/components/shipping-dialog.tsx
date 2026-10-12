"use client"

import { TruckIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import DateField from "@/common/components/date-field"
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
import { Input } from "@/common/components/ui/input"
import { Switch } from "@/common/components/ui/switch"

import { saveSaleShippingAction } from "../lib/actions/sale-operations.action"

type ShippingDialogProps = {
  saleId: string
  shipDate: string | null
  trackingNumber: string | null
  // Líneas que faltan por entregar: al marcarla enviada pasan a entregadas.
  pendingItemIds: string[]
  minDate: string
}

// Envío de una venta: cuándo se envía y, una vez dejado el paquete, su número de guía.
const ShippingDialog = ({ saleId, shipDate, trackingNumber, pendingItemIds, minDate }: ShippingDialogProps) => {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(shipDate ?? "")
  const [tracking, setTracking] = useState(trackingNumber ?? "")
  const [shipped, setShipped] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await saveSaleShippingAction({
        sale_id: saleId,
        ship_date: date || null,
        tracking_number: tracking.trim() || null,
        deliver_item_ids: shipped ? pendingItemIds : [],
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
        if (next) {
          setDate(shipDate ?? "")
          setTracking(trackingNumber ?? "")
          setShipped(false)
          setError(null)
        }
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 md:h-9">
          <TruckIcon aria-hidden />
          Envío
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Envío</DialogTitle>
          <DialogDescription>Cuándo se envía y, al dejar el paquete, el número de guía de la empresa de envíos.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <FormField label="Fecha de envío" htmlFor="ship-date" optional>
            <DateField id="ship-date" value={date} onChange={setDate} min={minDate} clearable placeholder="Sin fecha" />
          </FormField>
          <FormField label="Número de guía" htmlFor="ship-tracking" optional hint="El del recibo de MRW, Zoom, Tealca…">
            <Input id="ship-tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={60} placeholder="MRW 1234567890" className="h-11 md:h-9" />
          </FormField>
          {pendingItemIds.length > 0 && (
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Ya se envió
                <span className="block text-xs text-muted-foreground">Lo que falta por entregar pasa a Entregado.</span>
              </span>
              <Switch checked={shipped} onCheckedChange={setShipped} />
            </label>
          )}
          {error && <StatusAlert tone="error" title={error} />}
          <DialogFooter>
            <SubmitButton pending={pending}>{shipped ? "Guardar y marcar enviada" : "Guardar"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default ShippingDialog

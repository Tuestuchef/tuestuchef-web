"use client"

import { CalendarClockIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/common/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/common/components/ui/dialog"

import ExchangeRateForm from "./exchange-rate-form"

// Owner y admin: cargar la tasa de una fecha pasada (para ventas y movimientos retroactivos).
const PastRateDialog = ({ today }: { today: string }) => {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 md:h-9">
          <CalendarClockIcon aria-hidden />
          Tasa de otra fecha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tasa de una fecha pasada</DialogTitle>
          <DialogDescription>
            Las ventas y movimientos con esa fecha usarán estas tasas. Una vez cargada no se edita: si hay un error,
            registra otra para la misma fecha y queda como vigente.
          </DialogDescription>
        </DialogHeader>
        <ExchangeRateForm onSuccess={() => setOpen(false)} submitLabel="Guardar tasa" maxDate={today} />
      </DialogContent>
    </Dialog>
  )
}

export default PastRateDialog

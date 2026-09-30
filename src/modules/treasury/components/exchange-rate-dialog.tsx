"use client"

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

type ExchangeRateDialogProps = {
  label: string
  defaults?: React.ComponentProps<typeof ExchangeRateForm>["defaults"]
}

// Registrar o corregir la tasa de hoy (owner y admin). Corregir agrega una fila nueva.
const ExchangeRateDialog = ({ label, defaults }: ExchangeRateDialogProps) => {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 md:h-9">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm md:max-w-lg">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Tasa manual: queda como vigente desde ahora y la automática de la
            mañana no la reemplaza. Cambia solo la que necesites. Los
            movimientos ya registrados conservan su tasa.
          </DialogDescription>
        </DialogHeader>
        <ExchangeRateForm
          onSuccess={() => setOpen(false)}
          defaults={defaults}
        />
      </DialogContent>
    </Dialog>
  )
}

export default ExchangeRateDialog

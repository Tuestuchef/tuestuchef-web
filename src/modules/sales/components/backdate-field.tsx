"use client"

import { CalendarIcon, Loader2Icon } from "lucide-react"
import { useState, useTransition } from "react"

import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"
import { Input } from "@/common/components/ui/input"

import { getRatesForDateAction } from "../lib/actions/sale-operations.action"
import type { SaleRatesForDate } from "../lib/types/sales.types"

type BackdateFieldProps = {
  id: string
  today: string
  // Staff: días máximos hacia atrás. null = sin límite (owner y admin).
  maxDaysBack: number | null
  value: string
  onChange: (date: string, rates: SaleRatesForDate | "today") => void
  name?: string
}

const shiftDays = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// "Hoy · cambiar fecha". Con fecha pasada trae las tasas de esa fecha (o avisa que faltan).
const BackdateField = ({ id, today, maxDaysBack, value, onChange, name }: BackdateFieldProps) => {
  const [open, setOpen] = useState(value !== "" && value !== today)
  const [missingRate, setMissingRate] = useState(false)
  const [loading, startLoading] = useTransition()
  const min = maxDaysBack === null ? undefined : shiftDays(today, maxDaysBack)

  const select = (date: string) => {
    setMissingRate(false)
    if (!date || date === today) {
      onChange(today, "today")
      return
    }
    startLoading(async () => {
      const rates = await getRatesForDateAction(date)
      setMissingRate(rates === null)
      onChange(date, rates)
    })
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-fit justify-start px-0 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <CalendarIcon aria-hidden />
        Hoy · cambiar fecha
      </Button>
    )
  }

  return (
    <div className="grid gap-2">
      <FormField
        label="Fecha"
        htmlFor={id}
        hint={
          maxDaysBack === null
            ? "Con fecha pasada se usan las tasas de ese día."
            : `Hasta ${maxDaysBack} días atrás. Con fecha pasada se usan las tasas de ese día.`
        }
      >
        <div className="flex items-center gap-2">
          <Input
            id={id}
            name={name}
            type="date"
            min={min}
            max={today}
            value={value || today}
            onChange={(e) => select(e.target.value)}
            className="h-11 md:h-9"
          />
          {loading && <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-label="Buscando tasas" />}
        </div>
      </FormField>
      {missingRate && (
        <StatusAlert tone="warning" title="No hay tasas registradas para esa fecha">
          Owner o admin debe cargarlas en Tasas y cuentas antes de registrar con esa fecha.
        </StatusAlert>
      )}
    </div>
  )
}

export default BackdateField

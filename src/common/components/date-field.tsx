"use client"

import { CalendarIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { es } from "react-day-picker/locale"

import { Button } from "@/common/components/ui/button"
import { Calendar } from "@/common/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/common/components/ui/popover"
import { cn } from "@/common/lib/utils"

type DateFieldProps = {
  id?: string
  // Con name, va en un campo oculto (para formularios).
  name?: string
  // AAAA-MM-DD; "" = sin fecha.
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  min?: string
  max?: string
  required?: boolean
  disabled?: boolean
  // Permite dejarla vacía (p. ej. filtros).
  clearable?: boolean
  placeholder?: string
  className?: string
  "aria-label"?: string
}

const toDate = (iso: string | undefined) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}
const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

// "01/10/2026 · jueves 1 de octubre": día primero, como en Venezuela, y en palabras para que no haya dudas.
export const formatDateLabel = (iso: string) => {
  const date = toDate(iso)
  if (!date) return ""
  const dmy = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`
  return `${dmy} · ${date.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" })}`
}

// Fecha con calendario en español (en vez del campo nativo, que muestra el orden del sistema:
// en inglés, mes/día/año).
const DateField = ({
  id,
  name,
  value,
  defaultValue = "",
  onChange,
  min,
  max,
  required,
  disabled,
  clearable,
  placeholder = "Elige la fecha",
  className,
  "aria-label": ariaLabel,
}: DateFieldProps) => {
  const [inner, setInner] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const current = value ?? inner
  const selected = toDate(current)
  const minDate = toDate(min)
  const maxDate = toDate(max)
  const year = new Date().getFullYear()

  const set = (next: string) => {
    if (value === undefined) setInner(next)
    onChange?.(next)
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {name && <input type="hidden" name={name} value={current} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={ariaLabel}
            aria-required={required}
            className={cn("h-11 min-w-0 flex-1 justify-start font-normal md:h-9", !selected && "text-muted-foreground")}
          >
            <CalendarIcon aria-hidden />
            <span className="truncate">{selected ? formatDateLabel(current) : placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={es}
            captionLayout="dropdown"
            selected={selected}
            defaultMonth={selected ?? maxDate ?? minDate}
            startMonth={minDate ?? new Date(year - 5, 0)}
            endMonth={maxDate ?? new Date(year + 3, 11)}
            disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
            onSelect={(date) => {
              if (!date) return
              set(toIso(date))
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
      {clearable && selected && !disabled && (
        <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 md:size-9" onClick={() => set("")}>
          <XIcon aria-hidden />
          <span className="sr-only">Quitar la fecha</span>
        </Button>
      )}
    </div>
  )
}

export default DateField

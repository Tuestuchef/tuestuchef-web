"use client"

import { MinusIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/common/components/ui/button"
import { cn } from "@/common/lib/utils"

type QuantityStepperProps = {
  value: number
  onChange: (value: number) => void
  // Qué se cuenta, para lectores de pantalla ("combos", "Filipina M"…).
  label?: string
  min?: number
  max?: number
  // Con 1, el botón de menos quita la línea (pasa a 0) y muestra la papelera.
  removable?: boolean
  className?: string
}

// Cantidad con − y +, y el número se puede escribir (al tocarlo se selecciona para escribir encima).
// Mientras se escribe, cada número válido ya cuenta; al salir, si quedó vacío vuelve al anterior.
const QuantityStepper = ({ value, onChange, label, min = 1, max, removable = false, className }: QuantityStepperProps) => {
  const floor = removable ? 0 : min
  const [draft, setDraft] = useState<string | null>(null)
  const clamp = (n: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(floor, n))
  const suffix = label ? ` de ${label}` : ""
  const removing = removable && value <= 1

  return (
    <div className={cn("flex items-center rounded-md border", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 md:size-8"
        disabled={!removable && value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        {removing ? <Trash2Icon aria-hidden /> : <MinusIcon aria-hidden />}
        <span className="sr-only">{removing ? `Quitar${suffix}` : `Uno menos${suffix}`}</span>
      </Button>
      <input
        type="text"
        inputMode="numeric"
        enterKeyHint="done"
        aria-label={`Cantidad${suffix}`}
        value={draft ?? String(value)}
        onFocus={(e) => {
          setDraft(String(value))
          e.currentTarget.select()
        }}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 6)
          setDraft(digits)
          const n = Number(digits)
          // Un número válido cuenta al instante; el 0 (quitar) solo al salir, para no borrar mientras se escribe.
          if (digits && n >= Math.max(min, 1)) onChange(clamp(n))
        }}
        onBlur={() => {
          if (draft !== null && draft !== "") {
            const n = Number(draft)
            if (n !== value) onChange(clamp(n))
          }
          setDraft(null)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
        }}
        className="h-10 w-12 bg-transparent text-center text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 md:size-8"
        disabled={max !== undefined && value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        <PlusIcon aria-hidden />
        <span className="sr-only">Uno más{suffix}</span>
      </Button>
    </div>
  )
}


export default QuantityStepper

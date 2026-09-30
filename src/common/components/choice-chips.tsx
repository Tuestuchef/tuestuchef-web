"use client"

import { cn } from "@/common/lib/utils"

export type ChoiceChip = {
  value: string
  label: string
  hint?: string
}

type ChoiceChipsProps = {
  id?: string
  label: string
  options: readonly ChoiceChip[]
  value: string | null
  onChange: (value: string) => void
  className?: string
}

// Selección de una opción con botones grandes (pensado para el pulgar).
const ChoiceChips = ({ id, label, options, value, onChange, className }: ChoiceChipsProps) => (
  <div id={id} role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
    {options.map((option) => {
      const selected = option.value === value
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <span className="font-medium">{option.label}</span>
          {option.hint && (
            <span className={cn("text-xs", selected ? "opacity-80" : "text-muted-foreground")}>
              {option.hint}
            </span>
          )}
        </button>
      )
    })}
  </div>
)

export default ChoiceChips

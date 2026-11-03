"use client"

import { Progress } from "@/common/components/ui/progress"
import { cn } from "@/common/lib/utils"

type FormStepperProps = {
  steps: readonly string[]
  current: number
  // El paso más lejano visitado: se puede volver a cualquiera y saltar hasta ese.
  reached: number
  onSelect: (index: number) => void
}

// Encabezado de un formulario por pasos: barra de progreso, "Paso 2 de 4" y los nombres de los
// pasos (tocables para volver).
const FormStepper = ({ steps, current, reached, onSelect }: FormStepperProps) => (
  <nav aria-label="Pasos" className="grid gap-2">
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="font-semibold">{steps[current]}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        Paso {current + 1} de {steps.length}
      </span>
    </div>
    <Progress value={((current + 1) / steps.length) * 100} aria-label={`Paso ${current + 1} de ${steps.length}`} />
    <ol className="grid gap-1" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((title, index) => (
        <li key={title} className="min-w-0">
          <button
            type="button"
            disabled={index > reached}
            aria-current={index === current ? "step" : undefined}
            onClick={() => onSelect(index)}
            className={cn(
              "w-full truncate rounded-md px-1 py-1.5 text-center text-xs",
              index === current ? "font-semibold text-foreground" : "text-muted-foreground",
              index <= reached && index !== current && "hover:bg-accent hover:text-foreground",
              index > reached && "opacity-50"
            )}
          >
            {index + 1}. {title}
          </button>
        </li>
      ))}
    </ol>
  </nav>
)

export default FormStepper

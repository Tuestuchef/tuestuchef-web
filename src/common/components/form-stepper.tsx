"use client"

import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon, type LucideIcon } from "lucide-react"

import { Button } from "@/common/components/ui/button"
import { Progress } from "@/common/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/common/components/ui/tooltip"
import { cn } from "@/common/lib/utils"

export type FormStep = { title: string; icon: LucideIcon }

type FormStepperProps = {
  steps: readonly FormStep[]
  current: number
  // El paso más lejano visitado: se puede volver a cualquiera y saltar hasta ese.
  reached: number
  onSelect: (index: number) => void
}

// Encabezado de un formulario por pasos: el paso actual y "Paso 2 de 4", la barra de progreso y un
// ícono por paso (el nombre sale al pasar el mouse; tocables para volver a uno ya visto).
export const FormStepper = ({ steps, current, reached, onSelect }: FormStepperProps) => (
  <nav aria-label="Pasos" className="grid min-w-0 gap-2.5">
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span key={current} className="font-semibold motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        {steps[current].title}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        Paso {current + 1} de {steps.length}
      </span>
    </div>
    <Progress
      value={((current + 1) / steps.length) * 100}
      aria-label={`Paso ${current + 1} de ${steps.length}`}
      className="[&>[data-slot=progress-indicator]]:duration-500 [&>[data-slot=progress-indicator]]:ease-out"
    />
    <ol className="flex items-center justify-between">
      {steps.map(({ title, icon: Icon }, index) => {
        const isCurrent = index === current
        const done = index < current
        const locked = index > reached
        return (
          <li key={title}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={locked}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`${index + 1}. ${title}`}
                  onClick={() => onSelect(index)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full border transition-all duration-300",
                    isCurrent && "scale-110 border-primary bg-primary text-primary-foreground shadow-sm",
                    done && "border-foreground text-foreground hover:bg-accent",
                    !isCurrent && !done && !locked && "text-muted-foreground hover:bg-accent hover:text-foreground",
                    locked && "text-muted-foreground opacity-40"
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {index + 1}. {title}
              </TooltipContent>
            </Tooltip>
          </li>
        )
      })}
    </ol>
  </nav>
)

// El contenido de un paso: entra deslizándose desde el lado hacia donde se avanzó.
export const FormStepPanel = ({ step, direction, children, className }: { step: number; direction: 1 | -1; children: React.ReactNode; className?: string }) => (
  <div
    key={step}
    className={cn(
      "grid min-w-0 gap-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 motion-safe:ease-out",
      direction === 1 ? "motion-safe:slide-in-from-right-8" : "motion-safe:slide-in-from-left-8",
      className
    )}
  >
    {children}
  </div>
)

type FormStepperFooterProps = {
  steps: readonly FormStep[]
  current: number
  onBack: () => void
  onNext: () => void
  // El paso no deja seguir (lo que falta va en `alert`).
  nextDisabled: boolean
  submitLabel: string
  submitting: boolean
  submitDisabled: boolean
  onSubmit: () => void
  // Lo que falta, un error o una nota; y el total mientras no es el último paso.
  alert?: React.ReactNode
  total?: React.ReactNode
}

// Barra de abajo, fija: volver (chevron), "Continuar a …" y, en el último paso, el botón de guardar.
export const FormStepperFooter = ({
  steps,
  current,
  onBack,
  onNext,
  nextDisabled,
  submitLabel,
  submitting,
  submitDisabled,
  onSubmit,
  alert,
  total,
}: FormStepperFooterProps) => {
  const isLast = current === steps.length - 1
  return (
    <div className="sticky bottom-(--bottom-nav-h) z-10 -mx-4 grid gap-3 border-t bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur md:static md:mx-0 md:rounded-lg md:border md:pb-4">
      {alert}
      {!isLast && total && (
        <div className="flex items-baseline justify-between gap-3 text-sm tabular-nums">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold">{total}</span>
        </div>
      )}
      <div className="flex gap-2">
        {current > 0 && (
          <Button type="button" variant="outline" className="size-12 shrink-0 transition-transform active:scale-95" onClick={onBack}>
            <ChevronLeftIcon className="size-5" aria-hidden />
            <span className="sr-only">Volver a {steps[current - 1].title}</span>
          </Button>
        )}
        {isLast ? (
          <Button type="button" className="h-12 min-w-0 flex-1 text-base transition-transform active:scale-[0.98]" disabled={submitDisabled} onClick={onSubmit}>
            {submitting && <Loader2Icon className="animate-spin" aria-hidden />}
            <span className="truncate">{submitLabel}</span>
          </Button>
        ) : (
          <Button type="button" className="h-12 min-w-0 flex-1 text-base transition-transform active:scale-[0.98]" disabled={nextDisabled} onClick={onNext}>
            <span className="truncate">Continuar a {steps[current + 1].title}</span>
            <ChevronRightIcon className="size-5" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  )
}

export default FormStepper

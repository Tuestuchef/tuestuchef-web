import { CircleXIcon } from "lucide-react"

import { Label } from "@/common/components/ui/label"
import { cn } from "@/common/lib/utils"

type FormFieldProps = {
  label: string
  htmlFor: string
  error?: string[]
  hint?: string
  optional?: boolean
  className?: string
  children: React.ReactNode
}

// Etiqueta + control + error (con icono: el error no depende solo del color).
const FormField = ({ label, htmlFor, error, hint, optional, className, children }: FormFieldProps) => (
  <div className={cn("grid gap-2", className)}>
    <Label htmlFor={htmlFor}>
      {label}
      {optional && <span className="font-normal text-muted-foreground">(opcional)</span>}
    </Label>
    {children}
    {hint && !error?.length && <p className="text-xs text-muted-foreground">{hint}</p>}
    {error?.length ? (
      <p id={`${htmlFor}-error`} className="flex items-start gap-1.5 text-sm text-destructive">
        <CircleXIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        {error[0]}
      </p>
    ) : null}
  </div>
)

export default FormField

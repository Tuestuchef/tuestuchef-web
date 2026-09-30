"use client"

import { Loader2Icon } from "lucide-react"

import { Button } from "@/common/components/ui/button"
import { cn } from "@/common/lib/utils"

type SubmitButtonProps = React.ComponentProps<typeof Button> & {
  pending: boolean
  pendingLabel?: string
}

const SubmitButton = ({
  children,
  pending,
  pendingLabel,
  disabled,
  className,
  ...props
}: SubmitButtonProps) => (
  <Button type="submit" disabled={pending || disabled} className={cn("h-11 md:h-9", className)} {...props}>
    {pending && <Loader2Icon className="animate-spin" aria-hidden />}
    {pending ? (pendingLabel ?? "Guardando…") : children}
  </Button>
)

export default SubmitButton

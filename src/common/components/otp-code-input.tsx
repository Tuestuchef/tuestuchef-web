"use client"

import { Input } from "@/common/components/ui/input"
import { cn } from "@/common/lib/utils"

type OtpCodeInputProps = {
  id: string
  name: string
  value: string
  onChange: (value: string) => void
  // Se llama al completar los 6 dígitos (para enviar sin tocar el botón).
  onComplete?: () => void
  invalid?: boolean
  autoFocus?: boolean
}

const CODE_LENGTH = 6

// Código de 6 dígitos. El teléfono lo sugiere desde el correo o SMS (one-time-code).
const OtpCodeInput = ({ id, name, value, onChange, onComplete, invalid, autoFocus }: OtpCodeInputProps) => (
  <Input
    id={id}
    name={name}
    value={value}
    onChange={(event) => {
      const digits = event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH)
      onChange(digits)
      if (digits.length === CODE_LENGTH && value.length !== CODE_LENGTH) onComplete?.()
    }}
    inputMode="numeric"
    autoComplete="one-time-code"
    pattern="\d{6}"
    maxLength={CODE_LENGTH}
    placeholder="000000"
    autoFocus={autoFocus}
    aria-invalid={invalid}
    className={cn("h-14 text-center font-mono text-2xl tracking-[0.5em] tabular-nums")}
  />
)

export default OtpCodeInput

"use client"

import { CopyIcon, QrCodeIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"

import { startMfaEnrollmentAction } from "../lib/actions/mfa.action"
import type { TotpEnrollment } from "../lib/types/auth.types"
import MfaCodeForm from "./mfa-code-form"

// Paso 1: generar el QR. Paso 2: escanearlo y confirmar con el primer código.
const MfaSetupForm = () => {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const start = () =>
    startTransition(async () => {
      setError(null)
      const result = await startMfaEnrollmentAction()
      if (result.ok) setEnrollment(result.enrollment)
      else setError(result.error)
    })

  if (!enrollment) {
    return (
      <div className="grid gap-4">
        <ol className="grid list-decimal gap-1 pl-5 text-sm text-muted-foreground">
          <li>Instala una app autenticadora (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
          <li>Genera tu código QR y escanéalo con la app.</li>
          <li>Escribe el código de 6 dígitos que muestra la app.</li>
        </ol>
        {error && <StatusAlert tone="error" title={error} />}
        <Button type="button" className="h-11 md:h-9" onClick={start} disabled={pending}>
          <QrCodeIcon aria-hidden />
          {pending ? "Generando…" : "Generar código QR"}
        </Button>
      </div>
    )
  }

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(enrollment.secret)
      toast.success("Clave copiada.")
    } catch {
      toast.error("No se pudo copiar. Escríbela a mano.")
    }
  }

  return (
    <div className="grid gap-4">
      <div className="mx-auto rounded-lg border bg-qr-surface p-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- QR en data URL, no pasa por next/image */}
        <img src={enrollment.qrCodeUrl} alt="Código QR para la app autenticadora" className="size-48" />
      </div>
      <div className="grid gap-1 text-sm">
        <span className="text-muted-foreground">¿No puedes escanear? Escribe esta clave en la app:</span>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-2 py-1.5 font-mono text-xs">
            {enrollment.secret}
          </code>
          <Button type="button" variant="outline" size="icon" onClick={copySecret} aria-label="Copiar clave">
            <CopyIcon />
          </Button>
        </div>
      </div>
      <MfaCodeForm factorId={enrollment.factorId} submitLabel="Activar y entrar" />
    </div>
  )
}

export default MfaSetupForm

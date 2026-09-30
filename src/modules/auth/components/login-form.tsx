"use client"

import { useRef, useState } from "react"

import FormField from "@/common/components/form-field"
import OtpCodeInput from "@/common/components/otp-code-input"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import { Input } from "@/common/components/ui/input"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { requestLoginCodeAction, verifyLoginCodeAction } from "../lib/actions/login-code.action"

type LoginFormProps = {
  redirectTo: string
}

// Sin contraseñas: correo → código de 6 dígitos.
const LoginForm = ({ redirectTo }: LoginFormProps) => {
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const codeFormRef = useRef<HTMLFormElement>(null)

  const request = useFormAction(requestLoginCodeAction)
  const resend = useFormAction(requestLoginCodeAction)
  const verify = useFormAction(verifyLoginCodeAction)

  useActionFeedback(request.state, () => setStep("code"), { showToast: false })
  useActionFeedback(resend.state)

  if (step === "email") {
    return (
      <form onSubmit={request.onSubmit} className="grid gap-4" noValidate>
        {request.state.status === "error" && request.state.message && (
          <StatusAlert tone="error" title={request.state.message} />
        )}
        <FormField label="Correo" htmlFor="login-email" error={request.state.fieldErrors?.email}>
          <Input
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 md:h-9"
          />
        </FormField>
        <SubmitButton pending={request.pending} pendingLabel="Enviando…">
          Enviarme un código
        </SubmitButton>
      </form>
    )
  }

  return (
    <div className="grid gap-4">
      <StatusAlert tone="info" title="Revisa tu correo">
        Si <span className="font-medium">{email}</span> tiene acceso, te llegó un código de 6 dígitos.
      </StatusAlert>

      <form ref={codeFormRef} onSubmit={verify.onSubmit} className="grid gap-4" noValidate>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        {verify.state.status === "error" && verify.state.message && (
          <StatusAlert tone="error" title={verify.state.message} />
        )}
        <FormField label="Código" htmlFor="login-code" error={verify.state.fieldErrors?.token}>
          <OtpCodeInput
            id="login-code"
            name="token"
            value={code}
            onChange={setCode}
            onComplete={() => codeFormRef.current?.requestSubmit()}
            invalid={Boolean(verify.state.fieldErrors?.token)}
            autoFocus
          />
        </FormField>
        <SubmitButton pending={verify.pending} pendingLabel="Entrando…" disabled={code.length !== 6}>
          Entrar
        </SubmitButton>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="link"
          className="h-auto px-0"
          onClick={() => {
            setStep("email")
            setCode("")
          }}
        >
          Cambiar correo
        </Button>
        <form onSubmit={resend.onSubmit}>
          <input type="hidden" name="email" value={email} />
          <Button type="submit" variant="link" className="h-auto px-0" disabled={resend.pending}>
            {resend.pending ? "Enviando…" : "Enviar otro código"}
          </Button>
        </form>
      </div>
      {resend.state.status === "error" && resend.state.message && (
        <StatusAlert tone="warning" title={resend.state.message} />
      )}
    </div>
  )
}

export default LoginForm

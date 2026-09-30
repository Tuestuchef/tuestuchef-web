"use client"

import { useRef, useState } from "react"

import FormField from "@/common/components/form-field"
import OtpCodeInput from "@/common/components/otp-code-input"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { verifyMfaAction } from "../lib/actions/mfa.action"

type MfaCodeFormProps = {
  factorId: string
  submitLabel: string
}

// Código de 6 dígitos de la app autenticadora. Al acertar, la sesión queda en aal2.
const MfaCodeForm = ({ factorId, submitLabel }: MfaCodeFormProps) => {
  const [code, setCode] = useState("")
  const formRef = useRef<HTMLFormElement>(null)
  const { state, onSubmit, pending } = useFormAction(verifyMfaAction)

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-4" noValidate>
      <input type="hidden" name="factor_id" value={factorId} />
      {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
      <FormField label="Código de la app" htmlFor="mfa-code" error={state.fieldErrors?.code}>
        <OtpCodeInput
          id="mfa-code"
          name="code"
          value={code}
          onChange={setCode}
          onComplete={() => formRef.current?.requestSubmit()}
          invalid={Boolean(state.fieldErrors?.code)}
          autoFocus
        />
      </FormField>
      <SubmitButton pending={pending} pendingLabel="Verificando…" disabled={code.length !== 6}>
        {submitLabel}
      </SubmitButton>
    </form>
  )
}

export default MfaCodeForm

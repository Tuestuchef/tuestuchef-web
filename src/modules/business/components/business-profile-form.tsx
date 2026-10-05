"use client"

import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Input } from "@/common/components/ui/input"
import { Textarea } from "@/common/components/ui/textarea"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"
import { formatPhone } from "@/modules/customers/lib/utils/normalize-contact.util"

import { saveBusinessProfileAction } from "../lib/actions/business-profile.action"
import type { BusinessProfile } from "../lib/types/business.types"
import { formatTaxId } from "../lib/utils/format-tax-id.util"

const BusinessProfileForm = ({ profile }: { profile: BusinessProfile }) => {
  const { state, onSubmit, pending } = useFormAction(saveBusinessProfileAction)
  useActionFeedback(state)
  const errors = state.fieldErrors ?? {}

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
      <FormField label="Correo de contacto" htmlFor="bp-email" error={errors.email} optional hint="El que ven los clientes. No cambia el remitente de los correos del sistema.">
        <Input id="bp-email" name="email" type="email" inputMode="email" autoComplete="off" defaultValue={profile.email ?? ""} className="h-11 md:h-9" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Teléfono" htmlFor="bp-phone" error={errors.phone} optional>
          <Input id="bp-phone" name="phone" type="tel" inputMode="tel" placeholder="0414-123.45.67" defaultValue={profile.phone ? formatPhone(profile.phone) : ""} className="h-11 md:h-9" />
        </FormField>
        <FormField label="WhatsApp" htmlFor="bp-whatsapp" error={errors.whatsapp} optional hint="Si es el mismo teléfono, repítelo.">
          <Input id="bp-whatsapp" name="whatsapp" type="tel" inputMode="tel" placeholder="0414-123.45.67" defaultValue={profile.whatsapp ? formatPhone(profile.whatsapp) : ""} className="h-11 md:h-9" />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Instagram" htmlFor="bp-instagram" error={errors.instagram} optional hint="Usuario o enlace del perfil.">
          <Input id="bp-instagram" name="instagram" placeholder="@tuestuchef" defaultValue={profile.instagram ? `@${profile.instagram}` : ""} className="h-11 md:h-9" />
        </FormField>
        <FormField label="RIF" htmlFor="bp-tax-id" error={errors.tax_id} optional>
          <Input id="bp-tax-id" name="tax_id" placeholder="J-12345678-9" defaultValue={profile.taxId ? formatTaxId(profile.taxId) : ""} className="h-11 md:h-9" />
        </FormField>
      </div>
      <FormField label="Dirección" htmlFor="bp-address" error={errors.address} optional>
        <Textarea id="bp-address" name="address" rows={2} maxLength={300} defaultValue={profile.address ?? ""} />
      </FormField>
      <SubmitButton pending={pending} className="w-fit">
        Guardar
      </SubmitButton>
    </form>
  )
}

export default BusinessProfileForm

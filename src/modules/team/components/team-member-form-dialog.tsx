"use client"

import { PencilIcon, UserPlusIcon } from "lucide-react"
import { useState } from "react"

import ActiveSwitchField from "@/common/components/active-switch-field"
import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/common/components/ui/dialog"
import { Input } from "@/common/components/ui/input"
import { Textarea } from "@/common/components/ui/textarea"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"
import { formatPhone } from "@/modules/customers/lib/utils/normalize-contact.util"

import { saveTeamMemberAction } from "../lib/actions/team.action"
import type { LinkableProfile, TeamMember } from "../lib/types/team.types"

type TeamMemberFormDialogProps = {
  member?: TeamMember
  profiles: LinkableProfile[]
}

// Persona del equipo: con o sin cuenta en el sistema.
const TeamMemberFormDialog = ({ member, profiles }: TeamMemberFormDialogProps) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(saveTeamMemberAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {member ? (
          <Button variant="outline" className="h-11 md:h-9">
            <PencilIcon aria-hidden />
            Editar
          </Button>
        ) : (
          <Button className="h-11 md:h-9">
            <UserPlusIcon aria-hidden />
            Nueva persona
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{member ? "Editar persona" : "Nueva persona del equipo"}</DialogTitle>
          <DialogDescription>
            Quien cobra un sueldo, tenga o no cuenta en el sistema (p. ej. una costurera que no usa el panel).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {member && <input type="hidden" name="id" value={member.id} />}
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

          <FormField label="Nombre" htmlFor="member-name" error={errors.full_name}>
            <Input id="member-name" name="full_name" defaultValue={member?.full_name} autoComplete="off" className="h-11 md:h-9" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Puesto" htmlFor="member-job" error={errors.job_title} optional>
              <Input id="member-job" name="job_title" defaultValue={member?.job_title ?? ""} placeholder="Costurera, ventas…" className="h-11 md:h-9" />
            </FormField>
            <FormField label="Teléfono" htmlFor="member-phone" error={errors.phone} optional>
              <Input
                id="member-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={member?.phone ? formatPhone(member.phone) : ""}
                className="h-11 md:h-9"
              />
            </FormField>
          </div>
          <FormField
            label="Cuenta en el sistema"
            htmlFor="member-profile"
            error={errors.profile_id}
            optional
            hint="Vincúlala si la persona también usa el panel."
          >
            <select
              id="member-profile"
              name="profile_id"
              defaultValue={member?.profile_id ?? ""}
              className="h-11 rounded-md border bg-background px-2 text-sm md:h-9"
            >
              <option value="">Sin cuenta</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Notas" htmlFor="member-notes" error={errors.notes} optional>
            <Textarea id="member-notes" name="notes" rows={2} defaultValue={member?.notes ?? ""} />
          </FormField>
          <FormField label="Cómo cobra" htmlFor="member-pay" hint="A destajo: se le cuentan las piezas al terminar las etapas que tiene asignadas.">
            <select id="member-pay" name="pay_basis" defaultValue={member?.pay_basis ?? "salary"} className="h-11 rounded-md border bg-background px-2 text-sm md:h-9">
              <option value="salary">Sueldo</option>
              <option value="piecework">Por pieza (destajo)</option>
              <option value="both">Sueldo y por pieza</option>
            </select>
          </FormField>
          {member && (
            <ActiveSwitchField defaultChecked={member.is_active} label="Activa" description="Las inactivas no aparecen al registrar pagos." />
          )}
          <SubmitButton pending={pending}>{member ? "Guardar cambios" : "Crear persona"}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default TeamMemberFormDialog

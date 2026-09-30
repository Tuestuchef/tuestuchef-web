"use client"

import { UserPlusIcon } from "lucide-react"
import { useState } from "react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/common/components/ui/select"
import { type AppRole, ROLE_LABELS } from "@/common/lib/constants/roles.constants"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { inviteUserAction } from "../lib/actions/invite-user.action"
import { USER_MESSAGES } from "../lib/constants/users.constants"

type InviteUserDialogProps = {
  roles: AppRole[]
  enabled: boolean
}

const InviteUserDialog = ({ roles, enabled }: InviteUserDialogProps) => {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<string>(roles.length === 1 ? roles[0] : "")
  const { state, onSubmit, pending } = useFormAction(inviteUserAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 md:h-9">
          <UserPlusIcon aria-hidden />
          Invitar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar usuario</DialogTitle>
          <DialogDescription>
            Le llega un correo con un enlace para entrar. Después entra con su correo y un código, sin contraseña.
          </DialogDescription>
        </DialogHeader>
        {!enabled ? (
          <StatusAlert tone="warning" title="Invitaciones no disponibles">
            {USER_MESSAGES.INVITES_DISABLED}
          </StatusAlert>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
            <FormField label="Nombre" htmlFor="invite-name" error={errors.full_name}>
              <Input id="invite-name" name="full_name" autoComplete="off" className="h-11 md:h-9" />
            </FormField>
            <FormField label="Correo" htmlFor="invite-email" error={errors.email}>
              <Input
                id="invite-email"
                name="email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="off"
                className="h-11 md:h-9"
              />
            </FormField>
            <FormField
              label="Rol"
              htmlFor="invite-role"
              error={errors.role}
              hint={
                roles.length === 1
                  ? "Como admin, solo puedes invitar usuarios staff."
                  : "Owner y admin deberán activar una app autenticadora (2FA) al entrar."
              }
            >
              <Select name="role" value={role} onValueChange={setRole}>
                <SelectTrigger id="invite-role" className="h-11 w-full md:h-9">
                  <SelectValue placeholder="Elige el rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((value) => (
                    <SelectItem key={value} value={value}>
                      {ROLE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <SubmitButton pending={pending} pendingLabel="Enviando…">
              Enviar invitación
            </SubmitButton>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default InviteUserDialog

"use client"

import { EllipsisVerticalIcon, ShieldIcon, UserCheckIcon, UserXIcon } from "lucide-react"
import { useState } from "react"

import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/common/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/common/components/ui/dropdown-menu"
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

import { changeUserRoleAction, setUserActiveAction } from "../lib/actions/update-user.action"
import type { TeamMember } from "../lib/types/users.types"

type UserRowActionsProps = {
  member: TeamMember
  roles: AppRole[]
  canChangeRole: boolean
  canToggleActive: boolean
}

const UserRowActions = ({ member, roles, canChangeRole, canToggleActive }: UserRowActionsProps) => {
  const [dialog, setDialog] = useState<"role" | "active" | null>(null)
  const [role, setRole] = useState<string>(member.role)
  const close = () => setDialog(null)

  const roleForm = useFormAction(changeUserRoleAction)
  const activeForm = useFormAction(setUserActiveAction)
  useActionFeedback(roleForm.state, close)
  useActionFeedback(activeForm.state, close)

  if (!canChangeRole && !canToggleActive) return null
  const name = member.fullName || member.email || "este usuario"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Acciones para ${name}`}>
            <EllipsisVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canChangeRole && (
            <DropdownMenuItem onSelect={() => setDialog("role")}>
              <ShieldIcon />
              Cambiar rol
            </DropdownMenuItem>
          )}
          {canToggleActive && (
            <DropdownMenuItem onSelect={() => setDialog("active")}>
              {member.isActive ? <UserXIcon /> : <UserCheckIcon />}
              {member.isActive ? "Desactivar" : "Activar"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "role"} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar rol</DialogTitle>
            <DialogDescription>
              {name} tiene el rol {ROLE_LABELS[member.role]}. El cambio queda registrado en el historial.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={roleForm.onSubmit} className="grid gap-4" noValidate>
            <input type="hidden" name="profile_id" value={member.id} />
            {roleForm.state.status === "error" && roleForm.state.message && (
              <StatusAlert tone="error" title={roleForm.state.message} />
            )}
            <FormField label="Nuevo rol" htmlFor={`role-${member.id}`} error={roleForm.state.fieldErrors?.role}>
              <Select name="role" value={role} onValueChange={setRole}>
                <SelectTrigger id={`role-${member.id}`} className="h-11 w-full md:h-9">
                  <SelectValue />
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
            <DialogFooter>
              <SubmitButton pending={roleForm.pending} disabled={role === member.role}>
                Guardar rol
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "active"} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{member.isActive ? "Desactivar usuario" : "Activar usuario"}</DialogTitle>
            <DialogDescription>
              {member.isActive
                ? `${name} no podrá iniciar sesión. Su historial se conserva; puedes activarlo de nuevo cuando quieras.`
                : `${name} podrá iniciar sesión otra vez con su rol ${ROLE_LABELS[member.role]}.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={activeForm.onSubmit} className="grid gap-4" noValidate>
            <input type="hidden" name="profile_id" value={member.id} />
            <input type="hidden" name="is_active" value={String(!member.isActive)} />
            {activeForm.state.status === "error" && activeForm.state.message && (
              <StatusAlert tone="error" title={activeForm.state.message} />
            )}
            <DialogFooter>
              <SubmitButton pending={activeForm.pending}>
                {member.isActive ? "Desactivar" : "Activar"}
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default UserRowActions

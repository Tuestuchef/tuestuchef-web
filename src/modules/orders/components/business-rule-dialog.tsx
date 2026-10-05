"use client"

import { PencilIcon, PlusIcon } from "lucide-react"
import { useState } from "react"

import ActiveSwitchField from "@/common/components/active-switch-field"
import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/common/components/ui/dialog"
import { Input } from "@/common/components/ui/input"
import { Switch } from "@/common/components/ui/switch"
import { Textarea } from "@/common/components/ui/textarea"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { saveBusinessRuleAction } from "../lib/actions/orders.action"
import type { BusinessRule } from "../lib/types/orders.types"

// Crear o editar una regla de negocio. Cada cambio queda en el historial.
const BusinessRuleDialog = ({ rule }: { rule?: BusinessRule }) => {
  const [open, setOpen] = useState(false)
  const [enforced, setEnforced] = useState(rule?.enforcedBySystem ?? false)
  const { state, onSubmit, pending } = useFormAction(saveBusinessRuleAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {rule ? (
          <Button variant="ghost" size="icon" aria-label={`Editar ${rule.title}`}>
            <PencilIcon />
          </Button>
        ) : (
          <Button className="h-11 md:h-9">
            <PlusIcon aria-hidden />
            Nueva regla
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? "Editar regla" : "Nueva regla"}</DialogTitle>
          <DialogDescription>Todo el equipo la lee. Los cambios quedan registrados.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {rule && <input type="hidden" name="id" value={rule.id} />}
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          <FormField label="Título" htmlFor="br-title" error={errors.title}>
            <Input id="br-title" name="title" defaultValue={rule?.title} className="h-11 md:h-9" />
          </FormField>
          <FormField label="Regla" htmlFor="br-body" error={errors.body}>
            <Textarea id="br-body" name="body" rows={5} defaultValue={rule?.body} />
          </FormField>
          <FormField label="Orden" htmlFor="br-order" error={errors.sort_order} hint="Menor aparece primero.">
            <Input id="br-order" name="sort_order" type="number" min={0} defaultValue={rule?.sortOrder ?? 0} className="h-11 md:h-9" />
          </FormField>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              La aplica el sistema
              <span className="block text-xs text-muted-foreground">Márcalo solo si el sistema la hace cumplir solo.</span>
            </span>
            <Switch checked={enforced} onCheckedChange={setEnforced} />
          </label>
          <input type="hidden" name="enforced_by_system" value={enforced ? "true" : "false"} />
          {rule && <ActiveSwitchField defaultChecked={rule.isActive} label="Vigente" />}
          <SubmitButton pending={pending}>{rule ? "Guardar cambios" : "Crear regla"}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default BusinessRuleDialog

"use client"

import { ArrowRightIcon, UserCogIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/common/components/ui/dialog"
import { Input } from "@/common/components/ui/input"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"
import { ITEM_STATUS_LABELS } from "@/modules/sales/lib/constants/sales.constants"

import { advanceLineAction, assignStageAction } from "../lib/actions/orders.action"
import type { ProductionStage } from "../lib/constants/orders.constants"
import type { Assignee } from "../lib/types/orders.types"

// Pasa la línea a su siguiente etapa (las que no aplican se saltan solas).
export const AdvanceStageButton = ({ itemId, nextStage, size = "sm" }: { itemId: string; nextStage: ProductionStage | null; size?: "sm" | "default" }) => {
  const [pending, startTransition] = useTransition()
  if (!nextStage) return null
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await advanceLineAction(itemId)
          if (result.ok) toast.success(result.message)
          else toast.error(result.error)
        })
      }
    >
      <ArrowRightIcon aria-hidden />
      {ITEM_STATUS_LABELS[nextStage]}
    </Button>
  )
}

type AssignStageDialogProps = {
  itemId: string
  stages: ProductionStage[]
  assignees: Assignee[]
  defaultStage?: ProductionStage
}

// Asignar una etapa a una persona del equipo o a un taller (con fecha estimada si es taller).
export const AssignStageDialog = ({ itemId, stages, assignees, defaultStage }: AssignStageDialogProps) => {
  const [open, setOpen] = useState(false)
  const [assignee, setAssignee] = useState("")
  const { state, onSubmit, pending } = useFormAction(assignStageAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}
  if (stages.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <UserCogIcon aria-hidden />
          Asignar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar etapa</DialogTitle>
          <DialogDescription>A una persona del equipo o a un taller. A destajo, las piezas se cuentan al terminar la etapa.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="sale_item_id" value={itemId} />
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          <FormField label="Etapa" htmlFor="as-stage" error={errors.stage}>
            <select id="as-stage" name="stage" defaultValue={defaultStage ?? stages[0]} className="h-11 rounded-md border bg-background px-2 text-sm md:h-9">
              {stages.map((s) => (
                <option key={s} value={s}>
                  {ITEM_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Quién" htmlFor="as-who" error={errors.assignee}>
            <select
              id="as-who"
              name="assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="h-11 rounded-md border bg-background px-2 text-sm md:h-9"
            >
              <option value="">Elige</option>
              <optgroup label="Equipo">
                {assignees
                  .filter((a) => a.kind === "member")
                  .map((a) => (
                    <option key={a.id} value={`member:${a.id}`}>
                      {a.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Talleres">
                {assignees
                  .filter((a) => a.kind === "workshop")
                  .map((a) => (
                    <option key={a.id} value={`workshop:${a.id}`}>
                      {a.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </FormField>
          {assignee.startsWith("workshop:") && (
            <FormField label="Fecha estimada de entrega" htmlFor="as-date" optional hint="La que confirmaste con el taller.">
              <Input id="as-date" name="expected_date" type="date" className="h-11 md:h-9" />
            </FormField>
          )}
          <FormField label="Nota" htmlFor="as-note" error={errors.note} optional>
            <Input id="as-note" name="note" className="h-11 md:h-9" />
          </FormField>
          <SubmitButton pending={pending}>Asignar</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

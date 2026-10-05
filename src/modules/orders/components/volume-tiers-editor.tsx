"use client"

import { Trash2Icon } from "lucide-react"
import { useTransition } from "react"
import { toast } from "sonner"

import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import { Input } from "@/common/components/ui/input"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { addVolumeTierAction, deleteVolumeTierAction } from "../lib/actions/order-settings.action"
import { VOLUME_SCOPE_LABELS, type VolumeDiscountScope } from "../lib/constants/orders.constants"
import type { VolumeTier } from "../lib/types/orders.types"

const number = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 })

// Tramos de descuento al mayor de un alcance: "desde N piezas, X%". Se aplica el más alto alcanzado.
const VolumeTiersEditor = ({ scope, tiers }: { scope: VolumeDiscountScope; tiers: VolumeTier[] }) => {
  const [pending, startTransition] = useTransition()
  const { state, onSubmit, pending: saving } = useFormAction(addVolumeTierAction)
  useActionFeedback(state)
  const errors = state.fieldErrors ?? {}
  const labels = VOLUME_SCOPE_LABELS[scope]

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await deleteVolumeTierAction(id)
      if (!result.ok) toast.error(result.error)
    })

  return (
    <section className="grid gap-3">
      <div className="grid gap-0.5">
        <h3 className="text-sm font-medium">{labels.title}</h3>
        <p className="text-xs text-muted-foreground">{labels.description}</p>
      </div>
      {tiers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin tramos: no hay descuento al mayor.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {tiers.map((tier) => (
            <li key={tier.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="flex-1">Desde {number.format(tier.minQuantity)} piezas</span>
              <span className="font-medium tabular-nums">{number.format(tier.percent)}%</span>
              <Button type="button" variant="ghost" size="icon" className="size-9" disabled={pending} onClick={() => remove(tier.id)}>
                <Trash2Icon aria-hidden />
                <span className="sr-only">Quitar el tramo desde {tier.minQuantity}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form key={state.submissionId} onSubmit={onSubmit} className="grid gap-3 rounded-lg border p-3" noValidate>
        <input type="hidden" name="scope" value={scope} />
        {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Desde (piezas)" htmlFor={`${scope}-min`} error={errors.min_quantity}>
            <Input id={`${scope}-min`} name="min_quantity" inputMode="numeric" placeholder="12" className="h-11 md:h-9" />
          </FormField>
          <FormField label="Descuento (%)" htmlFor={`${scope}-percent`} error={errors.percent}>
            <Input id={`${scope}-percent`} name="percent" inputMode="decimal" placeholder="5" className="h-11 md:h-9" />
          </FormField>
        </div>
        <SubmitButton pending={saving} className="w-fit">
          Agregar tramo
        </SubmitButton>
      </form>
    </section>
  )
}

export default VolumeTiersEditor

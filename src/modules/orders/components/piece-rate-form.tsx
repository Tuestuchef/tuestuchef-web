"use client"

import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Input } from "@/common/components/ui/input"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"
import { ITEM_STATUS_LABELS } from "@/modules/sales/lib/constants/sales.constants"

import { addPieceRateAction } from "../lib/actions/orders.action"
import { ASSIGNABLE_STAGES } from "../lib/constants/orders.constants"

const PieceRateForm = ({ categories }: { categories: { id: string; name: string }[] }) => {
  const { state, onSubmit, pending } = useFormAction(addPieceRateAction)
  useActionFeedback(state)
  const errors = state.fieldErrors ?? {}

  return (
    <form key={state.submissionId} onSubmit={onSubmit} className="grid gap-3 rounded-lg border p-3" noValidate>
      {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Categoría" htmlFor="pr-category" error={errors.product_category_id}>
          <select id="pr-category" name="product_category_id" defaultValue="" className="h-11 rounded-md border bg-background px-2 text-sm md:h-9">
            <option value="">Elige</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Etapa" htmlFor="pr-stage" error={errors.stage}>
          <select id="pr-stage" name="stage" defaultValue="sewing" className="h-11 rounded-md border bg-background px-2 text-sm md:h-9">
            {ASSIGNABLE_STAGES.map((s) => (
              <option key={s} value={s}>
                {ITEM_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="USD por pieza" htmlFor="pr-rate" error={errors.rate_usd}>
          <Input id="pr-rate" name="rate_usd" inputMode="decimal" placeholder="1,50" className="h-11 md:h-9" />
        </FormField>
      </div>
      <SubmitButton pending={pending} className="w-fit">
        Guardar tarifa
      </SubmitButton>
    </form>
  )
}

export default PieceRateForm

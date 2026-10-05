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

import { addComboComponentAction, deleteComboComponentAction } from "../lib/actions/combo.action"
import type { ComboComponent, ComboComponentOption } from "../lib/types/products.types"

type ComboComponentsEditorProps = {
  comboId: string
  components: ComboComponent[]
  options: ComboComponentOption[]
  canManage: boolean
}

// Qué productos lleva el combo y cuántos de cada uno. La talla y el color se eligen al vender.
const ComboComponentsEditor = ({ comboId, components, options, canManage }: ComboComponentsEditorProps) => {
  const [pending, startTransition] = useTransition()
  const { state, onSubmit, pending: saving } = useFormAction(addComboComponentAction)
  useActionFeedback(state)
  const errors = state.fieldErrors ?? {}
  const available = options.filter((o) => !components.some((c) => c.productId === o.id))

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await deleteComboComponentAction(id)
      if (!result.ok) toast.error(result.error)
    })

  return (
    <div className="grid gap-4">
      {components.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin componentes. Un combo sin componentes no se puede vender.</p>
      ) : (
        <ul className="divide-y">
          {components.map((component) => (
            <li key={component.id} className="flex items-center gap-3 py-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums">
                {component.quantity}×
              </span>
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="text-sm font-medium">{component.productName}</span>
                <span className="text-xs text-muted-foreground">
                  {component.variantCount === 0
                    ? "Sin variantes activas: no se podrá vender"
                    : `${component.variantCount} ${component.variantCount === 1 ? "variante" : "variantes"} para elegir`}
                </span>
              </div>
              {canManage && (
                <Button type="button" variant="ghost" size="icon" className="size-9" disabled={pending} onClick={() => remove(component.id)}>
                  <Trash2Icon aria-hidden />
                  <span className="sr-only">Quitar {component.productName}</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage &&
        (available.length === 0 ? (
          components.length === 0 && (
            <StatusAlert tone="info" title="No hay productos para agregar">
              Crea primero los productos que forman el combo.
            </StatusAlert>
          )
        ) : (
          <form key={state.submissionId} onSubmit={onSubmit} className="grid gap-3 rounded-lg border p-3" noValidate>
            <input type="hidden" name="combo_product_id" value={comboId} />
            {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <FormField label="Producto" htmlFor="combo-component" error={errors.component_product_id}>
                <select id="combo-component" name="component_product_id" defaultValue="" className="h-11 rounded-md border bg-background px-2 text-sm md:h-9">
                  <option value="">Elige el producto</option>
                  {available.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Cantidad" htmlFor="combo-quantity" error={errors.quantity}>
                <Input id="combo-quantity" name="quantity" inputMode="numeric" defaultValue="1" className="h-11 md:h-9" />
              </FormField>
            </div>
            <SubmitButton pending={saving} className="w-fit">
              Agregar al combo
            </SubmitButton>
          </form>
        ))}
    </div>
  )
}

export default ComboComponentsEditor

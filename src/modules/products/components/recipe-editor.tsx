"use client"

import { Trash2Icon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import { Input } from "@/common/components/ui/input"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { addRecipeLineAction, deleteRecipeLineAction } from "../lib/actions/recipe.action"
import { UNIT_LABELS } from "../lib/constants/products.constants"
import type { CatalogItem, MaterialOption, RecipeLine } from "../lib/types/products.types"

type RecipeEditorProps = {
  productId: string
  lines: RecipeLine[]
  materials: MaterialOption[]
  sizes: CatalogItem[]
  canManage: boolean
}

const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 4 })

// Receta: qué materia prima lleva cada prenda. Con talla = cantidad para esa talla;
// sin talla = cantidad por defecto.
const RecipeEditor = ({ productId, lines, materials, sizes, canManage }: RecipeEditorProps) => {
  const [material, setMaterial] = useState("")
  const [pending, startTransition] = useTransition()
  const { state, onSubmit, pending: saving } = useFormAction(addRecipeLineAction)
  useActionFeedback(state, () => setMaterial(""))
  const errors = state.fieldErrors ?? {}
  const unit = materials.find((m) => m.value === material)?.unit

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await deleteRecipeLineAction(id)
      if (!result.ok) toast.error(result.error)
    })

  return (
    <div className="grid gap-4">
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin receta. Al producir habrá que indicar el costo a mano y no se descontará materia prima.
        </p>
      ) : (
        <ul className="divide-y">
          {lines.map((line) => (
            <li key={line.id} className="flex items-center gap-3 py-2">
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="text-sm font-medium">{line.materialLabel}</span>
                <span className="text-xs text-muted-foreground">{line.sizeName ? `Talla ${line.sizeName}` : "Todas las tallas"}</span>
              </div>
              <span className="text-sm tabular-nums">
                {quantityFormat.format(line.quantity)} {UNIT_LABELS[line.unit].toLowerCase()}
              </span>
              {canManage && (
                <Button type="button" variant="ghost" size="icon" className="size-9" disabled={pending} onClick={() => remove(line.id)}>
                  <Trash2Icon aria-hidden />
                  <span className="sr-only">Quitar {line.materialLabel}</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage &&
        (materials.length === 0 ? (
          <StatusAlert tone="info" title="Aún no hay materia prima">
            Créala en Compras → Materia prima para armar la receta.
          </StatusAlert>
        ) : (
          <form key={state.submissionId} onSubmit={onSubmit} className="grid gap-3 rounded-lg border p-3" noValidate>
            <input type="hidden" name="product_id" value={productId} />
            {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
            <FormField label="Material" htmlFor="recipe-material" error={errors.material}>
              <select
                id="recipe-material"
                name="material"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="h-11 rounded-md border bg-background px-2 text-sm md:h-9"
              >
                <option value="">Elige el material</option>
                {materials.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Talla" htmlFor="recipe-size" optional hint="Vacío = todas las tallas.">
                <select id="recipe-size" name="size_id" className="h-11 rounded-md border bg-background px-2 text-sm md:h-9">
                  <option value="">Todas</option>
                  {sizes
                    .filter((s) => s.is_active)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </FormField>
              <FormField
                label={`Cantidad${unit ? ` (${UNIT_LABELS[unit].toLowerCase()})` : ""}`}
                htmlFor="recipe-quantity"
                error={errors.quantity}
              >
                <Input id="recipe-quantity" name="quantity" inputMode="decimal" placeholder="1,5" className="h-11 md:h-9" />
              </FormField>
            </div>
            <SubmitButton pending={saving} className="w-fit">
              Agregar a la receta
            </SubmitButton>
          </form>
        ))}
    </div>
  )
}

export default RecipeEditor

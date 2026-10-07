"use client"

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useTransition } from "react"
import { toast } from "sonner"

import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"

import { deleteComboComponentAction } from "../lib/actions/combo.action"
import type { ComboComponent, ComboComponentOption } from "../lib/types/products.types"
import ComboComponentDialog from "./combo-component-dialog"

type ComboComponentsEditorProps = {
  comboId: string
  components: ComboComponent[]
  options: ComboComponentOption[]
  canManage: boolean
}

// Nombre de un componente: el suyo, o sus productos ("Filipina botón / Filipina cierre").
const componentName = (component: ComboComponent) => component.label ?? component.products.map((p) => p.name).join(" / ")

// Qué lleva el combo: cada componente con su cantidad y los productos que acepta. El producto (si hay
// varios), la talla y el color se eligen al vender.
const ComboComponentsEditor = ({ comboId, components, options, canManage }: ComboComponentsEditorProps) => {
  const [pending, startTransition] = useTransition()
  const allTaken = new Set(components.flatMap((c) => c.products.map((p) => p.id)))
  // Para editar un componente: los productos de los demás no se pueden marcar.
  const takenByOthers = (component?: ComboComponent) =>
    new Set(components.filter((c) => c !== component).flatMap((c) => c.products.map((p) => p.id)))

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
          {components.map((component) => {
            const sellable = component.products.filter((p) => p.variantCount > 0)
            return (
              <li key={component.id} className="flex items-start gap-3 py-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums">
                  {component.quantity}×
                </span>
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-sm font-medium">{componentName(component)}</span>
                  <span className="text-xs text-muted-foreground">
                    {component.products.length > 1
                      ? `Al vender se elige: ${component.products.map((p) => p.name).join(" · ")}`
                      : component.label && component.products[0]
                        ? component.products[0].name
                        : "La talla y el color se eligen al vender"}
                  </span>
                  {sellable.length < component.products.length && (
                    <span className="text-xs text-muted-foreground">
                      {sellable.length === 0
                        ? "Sin variantes activas: no se podrá vender"
                        : `Sin variantes activas: ${component.products
                            .filter((p) => p.variantCount === 0)
                            .map((p) => p.name)
                            .join(", ")}`}
                    </span>
                  )}
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center">
                    <ComboComponentDialog
                      comboId={comboId}
                      component={component}
                      options={options}
                      takenIds={takenByOthers(component)}
                      trigger={
                        <Button type="button" variant="ghost" size="icon" className="size-9">
                          <PencilIcon aria-hidden />
                          <span className="sr-only">Editar {componentName(component)}</span>
                        </Button>
                      }
                    />
                    <Button type="button" variant="ghost" size="icon" className="size-9" disabled={pending} onClick={() => remove(component.id)}>
                      <Trash2Icon aria-hidden />
                      <span className="sr-only">Quitar {componentName(component)}</span>
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canManage &&
        (options.length === 0 ? (
          <StatusAlert tone="info" title="No hay productos para agregar">
            Crea primero los productos que forman el combo.
          </StatusAlert>
        ) : (
          options.some((o) => !allTaken.has(o.id)) && (
            <ComboComponentDialog
              comboId={comboId}
              options={options}
              takenIds={allTaken}
              trigger={
                <Button type="button" variant="outline" className="h-11 w-fit md:h-9">
                  <PlusIcon aria-hidden />
                  Agregar componente
                </Button>
              }
            />
          )
        ))}
    </div>
  )
}

export default ComboComponentsEditor

"use client"

import { SearchIcon } from "lucide-react"
import { type ReactNode, useState } from "react"

import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/common/components/ui/dialog"
import { Input } from "@/common/components/ui/input"
import { Label } from "@/common/components/ui/label"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { saveComboComponentAction } from "../lib/actions/combo.action"
import type { ComboComponent, ComboComponentOption } from "../lib/types/products.types"

type ComboComponentDialogProps = {
  comboId: string
  // Vacío = componente nuevo.
  component?: ComboComponent
  options: ComboComponentOption[]
  // Productos que ya están en otros componentes del combo (un producto va en uno solo).
  takenIds: Set<string>
  trigger: ReactNode
}

// Un componente del combo: cuántas piezas lleva y qué productos acepta. Con varios productos, al
// vender se elige uno (p. ej. filipina de botón, cierre o broche).
const ComboComponentDialog = ({ comboId, component, options, takenIds, trigger }: ComboComponentDialogProps) => {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>(() => component?.products.map((p) => p.id) ?? [])
  const [search, setSearch] = useState("")
  const { state, onSubmit, pending } = useFormAction(saveComboComponentAction)
  useActionFeedback(state, () => {
    setOpen(false)
    if (!component) setSelected([])
  })
  const errors = state.fieldErrors ?? {}
  const idPrefix = component?.id ?? "new"

  const query = search.trim().toLowerCase()
  const visible = options.filter((o) => !takenIds.has(o.id) && (!query || o.name.toLowerCase().includes(query) || selected.includes(o.id)))
  const toggle = (id: string, value: boolean) => setSelected((all) => (value ? [...all, id] : all.filter((x) => x !== id)))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{component ? "Editar componente" : "Nuevo componente"}</DialogTitle>
          <DialogDescription>
            Marca uno o varios productos. Si marcas varios, al vender se elige cuál lleva el cliente (por ejemplo, filipina de botón, cierre o
            broche). La talla y el color también se eligen al vender.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="combo_product_id" value={comboId} />
          {component && <input type="hidden" name="component_id" value={component.id} />}
          {selected.map((id) => (
            <input key={id} type="hidden" name="product_ids" value={id} />
          ))}
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <FormField label="Nombre (opcional)" htmlFor={`combo-label-${idPrefix}`} error={errors.label}>
              <Input
                id={`combo-label-${idPrefix}`}
                name="label"
                defaultValue={component?.label ?? ""}
                placeholder="Filipina manga corta"
                maxLength={80}
                className="h-11 md:h-9"
              />
            </FormField>
            <FormField label="Cantidad" htmlFor={`combo-quantity-${idPrefix}`} error={errors.quantity}>
              <Input
                id={`combo-quantity-${idPrefix}`}
                name="quantity"
                inputMode="numeric"
                defaultValue={String(component?.quantity ?? 1)}
                className="h-11 md:h-9"
              />
            </FormField>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">
              Productos {selected.length > 0 && <span className="font-normal text-muted-foreground">· {selected.length} marcados</span>}
            </legend>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar: filipina manga corta…"
                aria-label="Buscar productos"
                className="h-11 pl-8 md:h-9"
              />
            </div>
            {errors.product_ids && <p className="text-sm text-muted-foreground">{errors.product_ids[0]}</p>}
            <div className="grid max-h-72 gap-0.5 overflow-y-auto rounded-lg border p-2">
              {visible.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">No hay productos con ese nombre.</p>
              ) : (
                visible.map((o) => (
                  <div key={o.id} className="flex items-center gap-3 rounded-md px-1 py-1.5">
                    <input
                      id={`combo-${idPrefix}-${o.id}`}
                      type="checkbox"
                      checked={selected.includes(o.id)}
                      onChange={(e) => toggle(o.id, e.target.checked)}
                      className="size-5 shrink-0 accent-primary"
                    />
                    <Label htmlFor={`combo-${idPrefix}-${o.id}`} className="min-w-0 flex-1 font-normal">
                      {o.name}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </fieldset>

          <SubmitButton pending={pending} className="w-fit">
            {component ? "Guardar componente" : "Agregar al combo"}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default ComboComponentDialog

"use client"

import { PencilIcon, PlusIcon } from "lucide-react"
import { useState } from "react"

import ActiveSwitchField from "@/common/components/active-switch-field"
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
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { saveCatalogItemAction } from "../lib/actions/save-catalog-item.action"
import type { CatalogItem, CatalogKind } from "../lib/types/products.types"

type CatalogItemDialogProps = {
  kind: CatalogKind
  noun: string
  codeHint: string
  item?: CatalogItem
}

// Crear o editar una categoría de producto, una talla o un color.
const CatalogItemDialog = ({ kind, noun, codeHint, item }: CatalogItemDialogProps) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(saveCatalogItemAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? (
          <Button variant="ghost" size="icon" aria-label={`Editar ${item.name}`}>
            <PencilIcon />
          </Button>
        ) : (
          <Button className="h-11 md:h-9">
            <PlusIcon aria-hidden />
            Nuevo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? `Editar ${noun}` : `Nuevo ${noun}`}</DialogTitle>
          <DialogDescription>
            El código se usa en los SKU. Cambiarlo no modifica los SKU que ya existen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="kind" value={kind} />
          {item && <input type="hidden" name="id" value={item.id} />}
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <FormField label="Nombre" htmlFor={`${kind}-name`} error={errors.name}>
              <Input id={`${kind}-name`} name="name" defaultValue={item?.name} className="h-11 md:h-9" />
            </FormField>
            <FormField label="Código" htmlFor={`${kind}-code`} error={errors.code} hint={codeHint}>
              <Input
                id={`${kind}-code`}
                name="code"
                defaultValue={item?.code}
                autoCapitalize="characters"
                maxLength={6}
                className="h-11 uppercase md:h-9"
              />
            </FormField>
          </div>
          <FormField label="Orden" htmlFor={`${kind}-order`} error={errors.sort_order} hint="Menor aparece primero.">
            <Input
              id={`${kind}-order`}
              name="sort_order"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={item?.sort_order ?? 0}
              className="h-11 md:h-9"
            />
          </FormField>
          {item && <ActiveSwitchField defaultChecked={item.is_active} label="Activo" />}
          <SubmitButton pending={pending}>{item ? "Guardar cambios" : "Crear"}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CatalogItemDialog

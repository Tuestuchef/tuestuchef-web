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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/common/components/ui/select"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { saveMovementCategoryAction } from "../lib/actions/save-movement-category.action"
import {
  CATEGORY_TYPE_HINTS,
  CATEGORY_TYPE_LABELS,
  type CategoryType,
  EXPENSE_CATEGORY_TYPES,
  INCOME_CATEGORY_TYPES,
} from "../lib/constants/money-movements.constants"
import type { MovementCategory } from "../lib/types/money-movements.types"

type CategoryFormDialogProps = {
  category?: MovementCategory
}

const CategoryFormDialog = ({ category }: CategoryFormDialogProps) => {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<CategoryType | "">(category?.type ?? "")
  const { state, onSubmit, pending } = useFormAction(saveMovementCategoryAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}
  const isEdit = Boolean(category)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" aria-label={`Editar ${category!.name}`}>
            <PencilIcon />
          </Button>
        ) : (
          <Button className="h-11 md:h-9">
            <PlusIcon aria-hidden />
            Nueva categoría
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "El tipo no se cambia: cambiaría el significado de todo su historial."
              : "El tipo define cómo cuenta en la utilidad real y si es del negocio o personal."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {category && <input type="hidden" name="id" value={category.id} />}
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

          <FormField label="Nombre" htmlFor="category-name" error={errors.name}>
            <Input id="category-name" name="name" defaultValue={category?.name} className="h-11 md:h-9" />
          </FormField>

          {isEdit ? (
            <FormField label="Tipo" htmlFor="category-type" hint={CATEGORY_TYPE_HINTS[category!.type]}>
              <Input id="category-type" value={CATEGORY_TYPE_LABELS[category!.type]} disabled className="h-11 md:h-9" />
            </FormField>
          ) : (
            <FormField
              label="Tipo"
              htmlFor="category-type"
              error={errors.type}
              hint={type ? CATEGORY_TYPE_HINTS[type] : undefined}
            >
              <Select name="type" value={type} onValueChange={(value: CategoryType) => setType(value)}>
                <SelectTrigger id="category-type" className="h-11 w-full md:h-9">
                  <SelectValue placeholder="Elige el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Entradas</SelectLabel>
                    {INCOME_CATEGORY_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {CATEGORY_TYPE_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Salidas</SelectLabel>
                    {EXPENSE_CATEGORY_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {CATEGORY_TYPE_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FormField>
          )}

          {category && <ActiveSwitchField defaultChecked={category.is_active} label="Categoría activa" />}

          <SubmitButton pending={pending}>{isEdit ? "Guardar cambios" : "Crear categoría"}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CategoryFormDialog

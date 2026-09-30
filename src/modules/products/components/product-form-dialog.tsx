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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/common/components/ui/select"
import { Textarea } from "@/common/components/ui/textarea"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { saveProductAction } from "../lib/actions/save-product.action"
import {
  CLOSURE_LABELS,
  FIT_LABELS,
  FULFILLMENT_LABELS,
  GENDER_LABELS,
} from "../lib/constants/products.constants"
import type { CatalogItem, Product } from "../lib/types/products.types"

type ProductFormDialogProps = {
  categories: CatalogItem[]
  product?: Product
}

const NONE = "none"

// Selector de atributo opcional ("—" = no aplica).
const OptionalSelect = ({
  id,
  name,
  label,
  options,
  defaultValue,
}: {
  id: string
  name: string
  label: string
  options: Record<string, string>
  defaultValue?: string | null
}) => (
  <FormField label={label} htmlFor={id} optional>
    <Select name={name} defaultValue={defaultValue ?? NONE}>
      <SelectTrigger id={id} className="h-11 w-full md:h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>— No aplica</SelectItem>
        {Object.entries(options).map(([value, text]) => (
          <SelectItem key={value} value={value}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </FormField>
)

const ProductFormDialog = ({ categories, product }: ProductFormDialogProps) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(saveProductAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}
  const selectable = categories.filter((c) => c.is_active || c.id === product?.category_id)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {product ? (
          <Button variant="outline" className="h-11 md:h-9">
            <PencilIcon aria-hidden />
            Editar
          </Button>
        ) : (
          <Button className="h-11 md:h-9">
            <PlusIcon aria-hidden />
            Nuevo producto
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogDescription>
            El producto es el modelo (ej.: “Filipina manga corta dama broche”). Colores y tallas van en las variantes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {product && <input type="hidden" name="id" value={product.id} />}
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

          <FormField label="Nombre" htmlFor="product-name" error={errors.name}>
            <Input id="product-name" name="name" defaultValue={product?.name} className="h-11 md:h-9" />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Categoría" htmlFor="product-category" error={errors.category_id}>
              <Select name="category_id" defaultValue={product?.category_id}>
                <SelectTrigger id="product-category" className="h-11 w-full md:h-9">
                  <SelectValue placeholder="Elige la categoría" />
                </SelectTrigger>
                <SelectContent>
                  {selectable.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Despacho" htmlFor="product-fulfillment" error={errors.fulfillment_type}>
              <Select name="fulfillment_type" defaultValue={product?.fulfillment_type ?? "stock"}>
                <SelectTrigger id="product-fulfillment" className="h-11 w-full md:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FULFILLMENT_LABELS).map(([value, text]) => (
                    <SelectItem key={value} value={value}>
                      {text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <OptionalSelect id="product-gender" name="gender" label="Género" options={GENDER_LABELS} defaultValue={product?.gender} />
            <OptionalSelect id="product-closure" name="closure" label="Cierre" options={CLOSURE_LABELS} defaultValue={product?.closure} />
            <OptionalSelect id="product-fit" name="fit" label="Corte" options={FIT_LABELS} defaultValue={product?.fit} />
          </div>

          <FormField label="Descripción" htmlFor="product-description" error={errors.description} optional>
            <Textarea id="product-description" name="description" rows={3} defaultValue={product?.description ?? ""} />
          </FormField>

          {product && (
            <ActiveSwitchField
              defaultChecked={product.is_active}
              label="Producto activo"
              description="Un producto inactivo no se vende ni recibe stock."
            />
          )}

          <SubmitButton pending={pending}>{product ? "Guardar cambios" : "Crear y seguir"}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default ProductFormDialog

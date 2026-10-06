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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/common/components/ui/select"
import { Textarea } from "@/common/components/ui/textarea"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { saveProductAction } from "../lib/actions/save-product.action"
import {
  CLOSURE_LABELS,
  FIT_LABELS,
  FULFILLMENT_LABELS,
  GENDER_LABELS,
  type ProductKind,
  UNIT_LABELS,
} from "../lib/constants/products.constants"
import type { CatalogItem, Product } from "../lib/types/products.types"

type ProductFormDialogProps = {
  categories: CatalogItem[]
  product?: Product
  // Al crear: producto terminado o materia prima (al editar manda el del producto).
  kind?: ProductKind
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

const ProductFormDialog = ({ categories, product, kind = "finished_good" }: ProductFormDialogProps) => {
  const isRaw = (product?.kind ?? kind) === "raw_material"
  // Un combo solo lleva nombre, categoría y descripción: lo demás es de sus componentes.
  const isCombo = (product?.kind ?? kind) === "combo"
  const noun = isRaw ? "material" : isCombo ? "combo" : "producto"
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
            {`Nuevo ${noun}`}
          </Button>
        )}
      </DialogTrigger>
      {/* Más ancho que el diálogo por defecto: la fila de género, cierre y corte necesita tres columnas. */}
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{product ? `Editar ${noun}` : isRaw ? "Nueva materia prima" : `Nuevo ${noun}`}</DialogTitle>
          <DialogDescription>
            {isRaw
              ? "Ej.: “Tela antifluido”. Los colores van en las variantes; la unidad define cómo se compra y se consume."
              : isCombo
                ? "Ej.: “Combo Escuela”. Después agregas sus componentes y su precio por método de pago."
                : "El producto es el modelo (ej.: “Filipina manga corta dama broche”). Colores y tallas van en las variantes."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {product && <input type="hidden" name="id" value={product.id} />}
          {!product && <input type="hidden" name="kind" value={kind} />}
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

          <FormField label="Nombre" htmlFor="product-name" error={errors.name}>
            <Input id="product-name" name="name" defaultValue={product?.name} className="h-11 md:h-9" />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
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
            {isCombo ? (
              <input type="hidden" name="fulfillment_type" value="stock" />
            ) : isRaw ? (
              <FormField label="Unidad" htmlFor="product-unit" error={errors.unit}>
                <input type="hidden" name="fulfillment_type" value="stock" />
                <Select name="unit" defaultValue={product?.unit ?? "meter"}>
                  <SelectTrigger id="product-unit" className="h-11 w-full md:h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_LABELS).map(([value, text]) => (
                      <SelectItem key={value} value={value}>
                        {text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            ) : (
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
            )}
          </div>

          {!isRaw && !isCombo && (
            <div className="grid gap-4 sm:grid-cols-3 [&>*]:min-w-0">
              <OptionalSelect
                id="product-gender"
                name="gender"
                label="Género"
                options={GENDER_LABELS}
                defaultValue={product?.gender}
              />
              <OptionalSelect
                id="product-closure"
                name="closure"
                label="Cierre"
                options={CLOSURE_LABELS}
                defaultValue={product?.closure}
              />
              <OptionalSelect
                id="product-fit"
                name="fit"
                label="Corte"
                options={FIT_LABELS}
                defaultValue={product?.fit}
              />
            </div>
          )}

          {!isRaw && !isCombo && (
            <FormField
              label="Mano de obra por unidad (USDT)"
              htmlFor="product-labor"
              error={errors.labor_cost_usdt}
              optional
              hint="Solo para calcular el margen. No se resta de la utilidad: los sueldos ya se restan ahí."
            >
              <Input
                id="product-labor"
                name="labor_cost_usdt"
                inputMode="decimal"
                defaultValue={product?.labor_cost_usdt ? String(product.labor_cost_usdt) : ""}
                placeholder="0"
                className="h-11 md:h-9"
              />
            </FormField>
          )}

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

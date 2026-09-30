"use client"

import { LockIcon, PencilIcon, PlusIcon } from "lucide-react"
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
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { saveVariantAction } from "../lib/actions/save-variant.action"
import type { CatalogItem, VariantWithStock } from "../lib/types/products.types"

type VariantFormDialogProps = {
  productId: string
  colors: CatalogItem[]
  sizes: CatalogItem[]
  variant?: VariantWithStock
}

const NONE = "none"

const CatalogSelect = ({
  id,
  name,
  label,
  items,
  defaultValue,
  disabled,
}: {
  id: string
  name: string
  label: string
  items: CatalogItem[]
  defaultValue: string | null
  disabled?: boolean
}) => (
  <FormField label={label} htmlFor={id} optional>
    <Select name={name} defaultValue={defaultValue ?? NONE} disabled={disabled}>
      <SelectTrigger id={id} className="h-11 w-full md:h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>— Sin {label.toLowerCase()}</SelectItem>
        {items
          .filter((item) => item.is_active || item.id === defaultValue)
          .map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name} <span className="text-muted-foreground">({item.code})</span>
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  </FormField>
)

// Una variante suelta. Con movimientos de stock, su identidad (color, talla y SKU) queda fija.
const VariantFormDialog = ({ productId, colors, sizes, variant }: VariantFormDialogProps) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(saveVariantAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}
  const locked = Boolean(variant?.hasMovements)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant ? (
          <Button variant="ghost" size="icon" aria-label={`Editar ${variant.sku}`}>
            <PencilIcon />
          </Button>
        ) : (
          <Button variant="outline" className="h-11 md:h-9">
            <PlusIcon aria-hidden />
            Una variante
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{variant ? `Editar ${variant.sku}` : "Nueva variante"}</DialogTitle>
          <DialogDescription>Deja el SKU vacío para generarlo con los códigos.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="product_id" value={productId} />
          {variant && <input type="hidden" name="id" value={variant.id} />}
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          {locked && (
            <StatusAlert tone="info" title="Tiene movimientos de stock">
              El color, la talla y el SKU ya no se pueden cambiar.
            </StatusAlert>
          )}

          {locked && variant ? (
            <>
              {/* Enviamos los valores actuales: el servidor y la base los validan igual. */}
              <input type="hidden" name="color_id" value={variant.colorId ?? ""} />
              <input type="hidden" name="size_id" value={variant.sizeId ?? ""} />
              <input type="hidden" name="sku" value={variant.sku} />
              <p className="flex items-center gap-2 text-sm">
                <LockIcon className="size-4 text-muted-foreground" aria-hidden />
                <code className="font-mono">{variant.sku}</code>
                <span className="text-muted-foreground">
                  {[variant.colorName, variant.sizeName].filter(Boolean).join(" · ") || "Única"}
                </span>
              </p>
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <CatalogSelect id="variant-color" name="color_id" label="Color" items={colors} defaultValue={variant?.colorId ?? null} />
                <CatalogSelect id="variant-size" name="size_id" label="Talla" items={sizes} defaultValue={variant?.sizeId ?? null} />
              </div>
              <FormField label="SKU" htmlFor="variant-sku" error={errors.sku} optional hint="Ej.: FIL-D-BR-VIN-M">
                <Input
                  id="variant-sku"
                  name="sku"
                  defaultValue={variant?.sku}
                  autoCapitalize="characters"
                  className="h-11 font-mono uppercase md:h-9"
                />
              </FormField>
            </>
          )}

          <FormField
            label="Stock mínimo"
            htmlFor="variant-min"
            error={errors.min_stock}
            hint="Por debajo o igual a esto se marca como stock bajo. 0 = sin alerta."
          >
            <Input
              id="variant-min"
              name="min_stock"
              inputMode="decimal"
              defaultValue={variant ? String(variant.minStock) : "0"}
              className="h-11 md:h-9"
            />
          </FormField>

          {variant && <ActiveSwitchField defaultChecked={variant.isActive} label="Variante activa" />}
          <SubmitButton pending={pending}>{variant ? "Guardar cambios" : "Crear variante"}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default VariantFormDialog

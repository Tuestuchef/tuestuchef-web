"use client"

import { CalendarIcon, CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import { useDeferredValue, useMemo, useState } from "react"

import ChoiceChips from "@/common/components/choice-chips"
import DateField from "@/common/components/date-field"
import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/common/components/ui/command"
import { Input } from "@/common/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/common/components/ui/popover"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"
import { cn } from "@/common/lib/utils"
import { normalizeSearch, searchList } from "@/common/lib/utils/search.util"

import { createStockMovementAction } from "../lib/actions/create-stock-movement.action"
import { MOVEMENT_TYPE_LABELS, type StockMovementType } from "../lib/constants/products.constants"
import type { StockVariantOption } from "../lib/types/products.types"

type StockMovementFormProps = {
  variants: StockVariantOption[]
  allowedTypes: readonly StockMovementType[]
  today: string
}

// En pantalla, como máximo (el resto se encuentra escribiendo más).
const MAX_RESULTS = 40

const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 })

const DIRECTIONS = [
  { value: "in", label: "Suma (+)" },
  { value: "out", label: "Resta (−)" },
] as const

// Entrada de mercancía (compra o producción) y, para owner/admin, ajustes.
const StockMovementForm = ({ variants, allowedTypes, today }: StockMovementFormProps) => {
  const { state, onSubmit, pending } = useFormAction(createStockMovementAction)
  const [variantId, setVariantId] = useState("")
  const [type, setType] = useState<StockMovementType>(allowedTypes[0])
  const [direction, setDirection] = useState<"in" | "out">("in")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [showDate, setShowDate] = useState(false)
  const [formKey, setFormKey] = useState(0)

  useActionFeedback(state, () => {
    // Limpia para el siguiente; se mantiene el tipo elegido.
    setVariantId("")
    setDirection("in")
    setShowDate(false)
    setFormKey((k) => k + 1)
  })

  const errors = state.fieldErrors ?? {}
  const isAdjustment = type === "adjustment"
  // Producción: solo productos terminados (la materia prima se compra).
  const options = useMemo(
    () =>
      (isAdjustment ? variants : variants.filter((v) => !v.isRawMaterial)).map((v) => ({
        item: v,
        haystack: normalizeSearch(`${v.label} ${v.sku}`),
      })),
    [isAdjustment, variants]
  )
  const { matches, total } = useMemo(() => searchList(options, deferredQuery, MAX_RESULTS), [options, deferredQuery])
  const selected = options.find((o) => o.item.id === variantId)?.item
  const needsCost = !isAdjustment && selected !== undefined && !selected.hasRecipe

  return (
    <form key={formKey} onSubmit={onSubmit} className="grid gap-4" noValidate>
      {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

      <FormField label="Tipo" htmlFor="stock-type" error={errors.movement_type}>
        <ChoiceChips
          id="stock-type"
          label="Tipo de movimiento"
          value={type}
          onChange={(value) => setType(value as StockMovementType)}
          options={allowedTypes.map((t) => ({ value: t, label: MOVEMENT_TYPE_LABELS[t] }))}
        />
        <input type="hidden" name="movement_type" value={type} />
      </FormField>

      <FormField label="Producto" htmlFor="stock-variant" error={errors.variant_id}>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              id="stock-variant"
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={pickerOpen}
              className="h-auto min-h-11 w-full justify-between text-left font-normal md:min-h-9"
            >
              {selected ? (
                <span className="grid min-w-0">
                  <span className="truncate">{selected.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {selected.sku} · hay {quantityFormat.format(selected.quantity)}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">Buscar por nombre o SKU</span>
              )}
              <ChevronsUpDownIcon className="shrink-0 opacity-50" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
            {/* Filtro propio: con miles de variantes, el de cmdk se frena. */}
            <Command shouldFilter={false}>
              <CommandInput placeholder="Nombre, color, talla o SKU" value={query} onValueChange={setQuery} />
              <CommandList>
                <CommandEmpty>No hay coincidencias.</CommandEmpty>
                <CommandGroup>
                  {matches.map((variant) => (
                    <CommandItem
                      key={variant.id}
                      value={variant.id}
                      onSelect={() => {
                        setVariantId(variant.id)
                        setPickerOpen(false)
                      }}
                    >
                      <CheckIcon className={cn(variant.id === variantId ? "opacity-100" : "opacity-0")} aria-hidden />
                      <span className="grid min-w-0 flex-1">
                        <span className="truncate">{variant.label}</span>
                        <span className="font-mono text-xs text-muted-foreground">{variant.sku}</span>
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {quantityFormat.format(variant.quantity)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {total > matches.length && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">{total - matches.length} más: escribe para afinar la búsqueda.</p>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <input type="hidden" name="variant_id" value={variantId} />
      </FormField>

      {isAdjustment && (
        <FormField label="Dirección" htmlFor="stock-direction">
          <ChoiceChips
            id="stock-direction"
            label="Dirección del ajuste"
            value={direction}
            onChange={(value) => setDirection(value as "in" | "out")}
            options={DIRECTIONS}
          />
        </FormField>
      )}
      <input type="hidden" name="direction" value={isAdjustment ? direction : "in"} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Cantidad" htmlFor="stock-quantity" error={errors.quantity}>
          <Input id="stock-quantity" name="quantity" inputMode="decimal" className="h-11 md:h-9" />
        </FormField>
        {needsCost && (
          <FormField
            label="Costo unitario (USDT)"
            htmlFor="stock-cost"
            error={errors.unit_cost_usdt}
            hint="Este producto no tiene receta: indica lo que costó cada unidad, en valor real."
          >
            <Input id="stock-cost" name="unit_cost_usdt" inputMode="decimal" className="h-11 md:h-9" />
          </FormField>
        )}
      </div>

      {!isAdjustment && selected?.hasRecipe && (
        <p className="text-xs text-muted-foreground">
          Se descuenta la materia prima de la receta y el costo de cada prenda se calcula con el costo promedio de los
          materiales.
        </p>
      )}

      <FormField label={isAdjustment ? "Motivo" : "Nota"} htmlFor="stock-note" error={errors.note} optional={!isAdjustment}>
        <Input
          id="stock-note"
          name="note"
          placeholder={isAdjustment ? "Ej.: conteo físico, merma, prenda dañada" : "Ej.: lote, quién cosió"}
          className="h-11 md:h-9"
        />
      </FormField>

      {showDate ? (
        <FormField label="Fecha" htmlFor="stock-date" error={errors.date}>
          <DateField id="stock-date" name="date" max={today} defaultValue={today} />
        </FormField>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className="h-auto justify-start px-0 text-muted-foreground"
          onClick={() => setShowDate(true)}
        >
          <CalendarIcon aria-hidden />
          Hoy · cambiar fecha
        </Button>
      )}

      <SubmitButton pending={pending}>Registrar {MOVEMENT_TYPE_LABELS[type].toLowerCase()}</SubmitButton>
    </form>
  )
}

export default StockMovementForm

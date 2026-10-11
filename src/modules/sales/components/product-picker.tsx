"use client"

import { PackagePlusIcon } from "lucide-react"
import { useDeferredValue, useMemo, useState } from "react"

import { Button } from "@/common/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/common/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/common/components/ui/popover"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { normalizeSearch, searchList } from "@/common/lib/utils/search.util"
import { GENDER_LABELS } from "@/modules/products/lib/constants/products.constants"

import type { SellableVariant } from "../lib/types/sales.types"
import VariantPickerDialog from "./variant-picker-dialog"

type ProductPickerProps = {
  variants: SellableVariant[]
  priceMethodId?: string
  // Stock disponible de una variante (descontando lo que ya está en la lista); sin esto no se muestra stock.
  available?: (variantId: string) => number
  placeholder?: string
  onAdd: (variant: SellableVariant, quantity: number) => void
  // Un combo pide sus piezas en su propia ventana.
  onCombo: (combo: SellableVariant) => void
}

type ProductGroup = { productId: string; productName: string; variants: SellableVariant[]; search: string }

// En pantalla, como máximo (el resto se encuentra escribiendo más).
const MAX_RESULTS = 40

const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 })

// Buscar por producto (no por variante): al tocarlo se eligen género, color y talla con botones.
// La búsqueda encuentra también colores, tallas, géneros y SKU ("filipina 3/4 dama negra").
const ProductPicker = ({ variants, priceMethodId, available, placeholder = "Filipina 3/4 botón…", onAdd, onCombo }: ProductPickerProps) => {
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState<SellableVariant[] | null>(null)
  const [query, setQuery] = useState("")
  // La lista se filtra sin frenar lo que se escribe.
  const deferredQuery = useDeferredValue(query)

  const groups = useMemo(() => {
    const byProduct = new Map<string, ProductGroup>()
    for (const v of variants) {
      const group = byProduct.get(v.productId) ?? { productId: v.productId, productName: v.productName, variants: [], search: "" }
      group.variants.push(v)
      byProduct.set(v.productId, group)
    }
    return [...byProduct.values()]
      .map((g) => ({
        ...g,
        search: normalizeSearch([
          g.productName,
          ...new Set(g.variants.flatMap((v) => [v.gender ? GENDER_LABELS[v.gender] : "", v.color?.name ?? "", v.size?.name ?? "", v.sku])),
        ]
          .filter(Boolean)
          .join(" ")),
      }))
      .sort((a, b) => a.productName.localeCompare(b.productName, "es"))
  }, [variants])

  const { matches, total } = useMemo(
    () => searchList(groups.map((g) => ({ item: g, haystack: g.search })), deferredQuery, MAX_RESULTS),
    [groups, deferredQuery]
  )

  const pick = (group: ProductGroup) => {
    setOpen(false)
    setQuery("")
    const [first] = group.variants
    if (first.components) onCombo(first)
    else if (group.variants.length === 1) onAdd(first, 1)
    else setPicking(group.variants)
  }

  const summary = (group: ProductGroup) => {
    const [first] = group.variants
    if (first.components) return "Combo"
    const prices = priceMethodId ? group.variants.flatMap((v) => (v.pricesUsd[priceMethodId] === undefined ? [] : [v.pricesUsd[priceMethodId]])) : []
    const from = prices.length ? `desde ${formatMoney(Math.min(...prices), "USD")}` : null
    const madeToOrder = group.variants.every((v) => v.fulfillmentType === "made_to_order")
    const stock = available ? group.variants.reduce((sum, v) => sum + Math.max(available(v.id), 0), 0) : null
    const stockText = madeToOrder ? "Por encargo" : stock === null ? null : `Hay ${quantityFormat.format(stock)}`
    const variantsText = group.variants.length === 1 ? first.variantLabel : `${group.variants.length} variantes`
    return [variantsText, from, stockText].filter(Boolean).join(" · ")
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery("")
        }}
      >
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="h-11 justify-start font-normal text-muted-foreground md:h-9">
            <PackagePlusIcon aria-hidden />
            Buscar producto
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
          {/* El filtro es propio (cmdk compara letra por letra y se frena con miles de variantes). */}
          <Command shouldFilter={false}>
            <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>No hay coincidencias.</CommandEmpty>
              <CommandGroup>
                {matches.map((group) => (
                  <CommandItem key={group.productId} value={group.productId} onSelect={() => pick(group)}>
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate">{group.productName}</span>
                      <span className="truncate text-xs text-muted-foreground tabular-nums">{summary(group)}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {total > matches.length && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  {total - matches.length} más: escribe para afinar la búsqueda.
                </p>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <VariantPickerDialog variants={picking} priceMethodId={priceMethodId} available={available} onClose={() => setPicking(null)} onAdd={onAdd} />
    </>
  )
}

export default ProductPicker

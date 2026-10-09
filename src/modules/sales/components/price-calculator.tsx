"use client"

import { CopyIcon, MinusIcon, PackageOpenIcon, PlusIcon, SearchIcon, ShirtIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import ChoiceChips from "@/common/components/choice-chips"
import { Button } from "@/common/components/ui/button"
import { Input } from "@/common/components/ui/input"
import { cn } from "@/common/lib/utils"
import { formatMoney, formatRate } from "@/common/lib/utils/format-money.util"
import { GENDER_LABELS } from "@/modules/products/lib/constants/products.constants"

import { PRICE_CALCULATOR_MESSAGES, PRICE_CALCULATOR_STORAGE_KEY } from "../lib/constants/sales.constants"
import type { CalculatorProduct, PriceCalculatorData } from "../lib/types/sales.types"
import { type CalculatorLine, calculatorTotals, calculatorWhatsappText, lineExtraUsd, sizeSurchargesFor } from "../lib/utils/price-calculator.util"
import { unitsPerUsd } from "../lib/utils/sale-math.util"

const ALL = "all"

// "Filipína" y "filipina" son lo mismo al buscar.
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

const newLineId = () => crypto.randomUUID()

// Chip pequeño para elegir talla o color con recargo en una línea.
const OptionChip = ({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={onClick}
    className={cn(
      "inline-flex min-h-8 items-center rounded-full border px-2.5 text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      selected ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
    )}
  >
    {children}
  </button>
)

const priceFrom = (product: CalculatorProduct) => {
  const prices = Object.values(product.pricesUsd)
  return prices.length ? Math.min(...prices) : null
}

// Para responder rápido "¿cuánto cuesta…?": se tocan productos y abajo sale el total por método de pago.
// No guarda nada en la base; la lista vive solo en este navegador.
const PriceCalculator = ({ products, categories, methods, rates, volumeTiers }: PriceCalculatorData) => {
  const [lines, setLines] = useState<CalculatorLine[]>([])
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState(ALL)

  // La lista sobrevive a cambiar de pantalla (solo en este navegador).
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(PRICE_CALCULATOR_STORAGE_KEY) ?? "[]") as Partial<CalculatorLine>[]
      if (Array.isArray(saved) && saved.length) {
        // Las listas guardadas antes de las opciones no tenían id de línea.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de sessionStorage (como sale-form)
        setLines(saved.filter((l) => l.productId && l.quantity).map((l) => ({ ...l, id: l.id ?? newLineId() }) as CalculatorLine))
      }
    } catch {
      // Sin almacenamiento: empieza vacía.
    }
  }, [])
  useEffect(() => {
    try {
      sessionStorage.setItem(PRICE_CALCULATOR_STORAGE_KEY, JSON.stringify(lines))
    } catch {
      // Sin almacenamiento: no pasa nada.
    }
  }, [lines])

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const visibleLines = lines.filter((l) => byId.has(l.productId))
  const quantityOf = (id: string) => lines.filter((l) => l.productId === id).reduce((sum, l) => sum + l.quantity, 0)

  // Tocar un producto suma uno a su línea sin opciones (o la crea).
  const addProduct = (productId: string) =>
    setLines((all) => {
      const base = all.find((l) => l.productId === productId && !l.sizeId && !l.colorId && !l.gender)
      return base ? all.map((l) => (l === base ? { ...l, quantity: l.quantity + 1 } : l)) : [...all, { id: newLineId(), productId, quantity: 1 }]
    })

  // Otra línea del mismo producto, para pedirlo con otra talla o color (p. ej. 2 en M y 1 en 4XL).
  const addLineOf = (productId: string) => setLines((all) => [...all, { id: newLineId(), productId, quantity: 1 }])

  const changeLine = (lineId: string, delta: number) =>
    setLines((all) =>
      all.flatMap((l) => {
        if (l.id !== lineId) return [l]
        const quantity = l.quantity + delta
        return quantity > 0 ? [{ ...l, quantity }] : []
      })
    )

  // Elegir género, talla o color con recargo. Si ya hay una línea igual del mismo producto, se juntan.
  const setOption = (lineId: string, patch: Pick<CalculatorLine, "gender"> | Pick<CalculatorLine, "sizeId"> | Pick<CalculatorLine, "colorId">) =>
    setLines((all) => {
      const current = all.find((l) => l.id === lineId)
      if (!current) return all
      let next = { ...current, ...patch }
      // Otro género: la talla elegida puede no cobrar extra en él.
      const product = byId.get(next.productId)
      if ("gender" in patch && product && !sizeSurchargesFor(product, next.gender).some((s) => s.id === next.sizeId)) next = { ...next, sizeId: null }
      const twin = all.find(
        (l) =>
          l.id !== lineId &&
          l.productId === next.productId &&
          (l.gender ?? null) === (next.gender ?? null) &&
          (l.sizeId ?? null) === (next.sizeId ?? null) &&
          (l.colorId ?? null) === (next.colorId ?? null)
      )
      if (twin) return all.filter((l) => l.id !== lineId).map((l) => (l === twin ? { ...l, quantity: l.quantity + next.quantity } : l))
      return all.map((l) => (l.id === lineId ? next : l))
    })

  const terms = normalize(search).split(/\s+/).filter(Boolean)
  const shown = products.filter((p) => {
    if (category !== ALL && p.categoryId !== category) return false
    const haystack = normalize([p.name, p.categoryName, ...p.colors, ...p.genders.map((g) => GENDER_LABELS[g])].join(" "))
    return terms.every((term) => haystack.includes(term))
  })

  const totals = calculatorTotals({ lines: visibleLines, products: byId, methods, volumeTiers, rates })
  const hasBs = totals.methods.some((m) => m.currency === "VES")
  // Tasa del método en Bs, para mostrar en Bs los extras opcionales del mensaje.
  const bsMethod = methods.find((m) => m.currency === "VES")
  const bsPerUsd = bsMethod && rates ? unitsPerUsd(bsMethod, rates) : null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(calculatorWhatsappText(visibleLines, byId, totals, { bsPerUsd }))
      toast.success(PRICE_CALCULATOR_MESSAGES.COPIED)
    } catch {
      toast.error(PRICE_CALCULATOR_MESSAGES.COPY_FAILED)
    }
  }

  return (
    <div className={cn("grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start", visibleLines.length > 0 && "pb-20 lg:pb-0")}>
      {/* Productos */}
      <section className="grid min-w-0 gap-3" aria-label="Productos">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar: filipina vinotinto, gorro…"
            aria-label="Buscar producto"
            className="h-11 pl-9 md:h-9"
          />
        </div>
        {categories.length > 1 && (
          <ChoiceChips
            label="Categoría"
            value={category}
            onChange={setCategory}
            options={[{ value: ALL, label: "Todo" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
        )}

        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Ningún producto coincide con la búsqueda.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {shown.map((product) => {
              const quantity = quantityOf(product.id)
              const from = priceFrom(product)
              const Icon = product.isCombo ? PackageOpenIcon : ShirtIcon
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => addProduct(product.id)}
                    aria-label={`Sumar ${product.name}${quantity ? ` (van ${quantity})` : ""}`}
                    className={cn(
                      "relative grid h-full w-full gap-2 rounded-xl border bg-card p-2 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                      quantity > 0 && "border-primary"
                    )}
                  >
                    <span className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- fotos del bucket público (dominio configurable)
                        <img src={product.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
                      ) : (
                        <Icon className="size-6 text-muted-foreground" aria-hidden />
                      )}
                    </span>
                    <span className="grid gap-0.5">
                      <span className="text-sm leading-tight font-medium">{product.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {from === null ? "Sin precio" : `Desde ${formatMoney(from, "USD")}`}
                      </span>
                    </span>
                    {quantity > 0 && (
                      <span
                        aria-hidden
                        className="absolute top-3 right-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums"
                      >
                        {quantity}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Lista y totales */}
      <section id="total" className="grid scroll-mt-20 gap-3 rounded-xl border bg-card p-4 lg:sticky lg:top-20" aria-label="Lista y total">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Lista</h2>
          {visibleLines.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setLines([])}>
              <Trash2Icon aria-hidden />
              Vaciar
            </Button>
          )}
        </div>

        {visibleLines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Toca un producto para sumarlo.</p>
        ) : (
          <ul className="divide-y">
            {visibleLines.map((line) => {
              const product = byId.get(line.productId)!
              const extra = lineExtraUsd(product, line)
              const sizeOptions = sizeSurchargesFor(product, line.gender)
              const hasOptions =
                product.genders.length > 1 ||
                Object.values(product.genderSizeSurcharges).some((list) => list.length > 0) ||
                product.sizeSurcharges.length > 0 ||
                product.colorSurcharges.length > 0
              return (
                <li key={line.id} className="grid gap-2 py-2">
                  <div className="flex items-center gap-2">
                    <span className="grid min-w-0 flex-1">
                      <span className="text-sm">{product.name}</span>
                      {extra > 0 && <span className="text-xs text-muted-foreground tabular-nums">Incluye +{formatMoney(extra, "USD")} c/u</span>}
                    </span>
                    <Button variant="outline" size="icon" className="size-9 md:size-7" onClick={() => changeLine(line.id, -1)} aria-label={`Quitar un ${product.name}`}>
                      <MinusIcon aria-hidden />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium tabular-nums">{line.quantity}</span>
                    <Button variant="outline" size="icon" className="size-9 md:size-7" onClick={() => changeLine(line.id, 1)} aria-label={`Sumar un ${product.name}`}>
                      <PlusIcon aria-hidden />
                    </Button>
                  </div>
                  {/* Género (si ofrece varios): define qué tallas cobran extra. */}
                  {product.genders.length > 1 && (
                    <div role="radiogroup" aria-label={`Género de ${product.name}`} className="flex flex-wrap gap-1.5">
                      {product.genders.map((g) => (
                        <OptionChip key={g} selected={line.gender === g} onClick={() => setOption(line.id, { gender: line.gender === g ? null : g })}>
                          {GENDER_LABELS[g]}
                        </OptionChip>
                      ))}
                    </div>
                  )}
                  {/* Solo si el producto cobra extra en alguna talla o color: se elige aquí o queda como opcional en el mensaje. */}
                  {product.colorSurcharges.length > 0 && (
                    <div role="radiogroup" aria-label={`Color de ${product.name}`} className="flex flex-wrap gap-1.5">
                      <OptionChip selected={!line.colorId} onClick={() => setOption(line.id, { colorId: null })}>
                        Otro color
                      </OptionChip>
                      {product.colorSurcharges.map((c) => (
                        <OptionChip key={c.id} selected={line.colorId === c.id} onClick={() => setOption(line.id, { colorId: c.id })}>
                          {c.name} +{formatMoney(c.amountUsd, "USD")}
                        </OptionChip>
                      ))}
                    </div>
                  )}
                  {sizeOptions.length > 0 && (
                    <div role="radiogroup" aria-label={`Talla de ${product.name}`} className="flex flex-wrap gap-1.5">
                      <OptionChip selected={!line.sizeId} onClick={() => setOption(line.id, { sizeId: null })}>
                        Otra talla
                      </OptionChip>
                      {sizeOptions.map((sz) => (
                        <OptionChip key={sz.id} selected={line.sizeId === sz.id} onClick={() => setOption(line.id, { sizeId: sz.id })}>
                          {sz.name} +{formatMoney(sz.amountUsd, "USD")}
                        </OptionChip>
                      ))}
                    </div>
                  )}
                  {hasOptions && (
                    <Button variant="ghost" size="sm" className="w-fit" onClick={() => addLineOf(product.id)}>
                      <PlusIcon aria-hidden />
                      Otra talla o color
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {visibleLines.length > 0 && (
          <div className="grid gap-2 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              {totals.pieces} {totals.pieces === 1 ? "pieza" : "piezas"}
              {totals.volumePercent > 0 && ` · incluye ${totals.volumePercent}% al mayor`}
              {totals.nextTier && ` · con ${totals.nextTier.minQuantity} piezas, ${totals.nextTier.percent}% al mayor`}
            </p>
            {totals.methods.length === 0 ? (
              <p className="text-sm text-muted-foreground">Estos productos no tienen precio en ningún método de pago.</p>
            ) : (
              <dl className="grid gap-2">
                {totals.methods.map((m) => (
                  <div key={m.names.join("|")} className="grid gap-0.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-sm">{m.names.join(" / ")}</dt>
                      <dd className="text-lg font-semibold tabular-nums">
                        {m.amount === null ? "Falta la tasa" : formatMoney(m.amount, m.currency)}
                      </dd>
                    </div>
                    {m.currency === "VES" && m.amount !== null && (
                      <p className="text-right text-xs text-muted-foreground tabular-nums">{formatMoney(m.totalUsd, "USD")} × tasa</p>
                    )}
                    {m.missing.length > 0 && (
                      <p className="text-xs text-muted-foreground">Sin precio aquí: {m.missing.join(", ")} (no está en este total).</p>
                    )}
                  </div>
                ))}
              </dl>
            )}
            {hasBs && rates && (
              <p className={cn("flex items-start gap-1.5 text-xs", rates.isCurrent ? "text-muted-foreground" : "font-medium")}>
                {!rates.isCurrent && <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
                {rates.isCurrent
                  ? `Bs a la tasa BCV de hoy (${formatRate(rates.bcvUsd)}).`
                  : `No hay tasa de hoy: los Bs usan la última registrada (BCV ${formatRate(rates.bcvUsd)}).`}
              </p>
            )}
            <Button className="h-11 md:h-9" onClick={copy} disabled={totals.methods.length === 0}>
              <CopyIcon aria-hidden />
              Copiar para WhatsApp
            </Button>
          </div>
        )}
      </section>

      {/* En el celular, el total queda a la vista mientras se buscan productos. */}
      {visibleLines.length > 0 && totals.methods[0]?.amount != null && (
        <a
          href="#total"
          className="fixed inset-x-3 bottom-3 z-20 flex items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-lg lg:hidden"
        >
          <span className="text-sm">
            {totals.pieces} {totals.pieces === 1 ? "pieza" : "piezas"} · {totals.methods[0].names[0]}
          </span>
          <span className="font-semibold tabular-nums">{formatMoney(totals.methods[0].amount, totals.methods[0].currency)}</span>
        </a>
      )}
    </div>
  )
}

export default PriceCalculator

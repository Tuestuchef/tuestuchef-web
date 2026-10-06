"use client"

import { CopyIcon, MinusIcon, PackageOpenIcon, PlusIcon, SearchIcon, ShirtIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import ChoiceChips from "@/common/components/choice-chips"
import { Button } from "@/common/components/ui/button"
import { Input } from "@/common/components/ui/input"
import { cn } from "@/common/lib/utils"
import { formatMoney, formatRate } from "@/common/lib/utils/format-money.util"

import { PRICE_CALCULATOR_MESSAGES, PRICE_CALCULATOR_STORAGE_KEY } from "../lib/constants/sales.constants"
import type { CalculatorProduct, PriceCalculatorData } from "../lib/types/sales.types"
import { type CalculatorLine, calculatorTotals, calculatorWhatsappText } from "../lib/utils/price-calculator.util"

const ALL = "all"

// "Filipína" y "filipina" son lo mismo al buscar.
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

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
      const saved = JSON.parse(sessionStorage.getItem(PRICE_CALCULATOR_STORAGE_KEY) ?? "[]") as CalculatorLine[]
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de sessionStorage (como sale-form)
      if (Array.isArray(saved) && saved.length) setLines(saved)
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
  const quantityOf = (id: string) => lines.find((l) => l.productId === id)?.quantity ?? 0

  const change = (productId: string, delta: number) =>
    setLines((all) => {
      const current = all.find((l) => l.productId === productId)
      if (!current) return delta > 0 ? [...all, { productId, quantity: delta }] : all
      const quantity = current.quantity + delta
      return quantity > 0 ? all.map((l) => (l === current ? { ...l, quantity } : l)) : all.filter((l) => l !== current)
    })

  const terms = normalize(search).split(/\s+/).filter(Boolean)
  const shown = products.filter((p) => {
    if (category !== ALL && p.categoryId !== category) return false
    const haystack = normalize([p.name, p.categoryName, ...p.colors].join(" "))
    return terms.every((term) => haystack.includes(term))
  })

  const totals = calculatorTotals({ lines: visibleLines, products: byId, methods, volumeTiers, rates })
  const hasBs = totals.methods.some((m) => m.currency === "VES")

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(calculatorWhatsappText(visibleLines, byId, totals))
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
                    onClick={() => change(product.id, 1)}
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
              return (
                <li key={line.productId} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 text-sm">{product.name}</span>
                  <Button variant="outline" size="icon" className="size-9 md:size-7" onClick={() => change(line.productId, -1)} aria-label={`Quitar un ${product.name}`}>
                    <MinusIcon aria-hidden />
                  </Button>
                  <span className="w-6 text-center text-sm font-medium tabular-nums">{line.quantity}</span>
                  <Button variant="outline" size="icon" className="size-9 md:size-7" onClick={() => change(line.productId, 1)} aria-label={`Sumar un ${product.name}`}>
                    <PlusIcon aria-hidden />
                  </Button>
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

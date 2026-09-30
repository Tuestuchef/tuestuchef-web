"use client"

import {
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
  MinusIcon,
  PackagePlusIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import ChoiceChips from "@/common/components/choice-chips"
import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import StatusBadge from "@/common/components/status-badge"
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
import { Label } from "@/common/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/common/components/ui/popover"
import { Switch } from "@/common/components/ui/switch"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { cn } from "@/common/lib/utils"
import { formatMoney, formatRate } from "@/common/lib/utils/format-money.util"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"
import CustomerPicker, { type PickedCustomer } from "@/modules/customers/components/customer-picker"

import { createSaleAction } from "../lib/actions/create-sale.action"
import {
  CHANNEL_LABELS,
  DELIVERY_LABELS,
  type DeliveryMethod,
  type DiscountType,
  LAST_CHANNEL_STORAGE_KEY,
  MANUAL_CHANNELS,
  SALES_MESSAGES,
  type SaleChannel,
  type SaleLineSource,
  SOURCE_LABELS,
} from "../lib/constants/sales.constants"
import type { SaleFormData, SalePaymentMethod, SaleRatesForDate, SellableVariant } from "../lib/types/sales.types"
import {
  discountPercent,
  discountUsd,
  isSettled,
  lineTotal,
  methodAmountToUsd,
  round,
  usdToMethodAmount,
} from "../lib/utils/sale-math.util"
import BackdateField from "./backdate-field"

type CartLine = { variantId: string; quantity: number; source: SaleLineSource }
type PaymentMode = "full" | "custom" | "none"
type PaymentRow = { key: number; methodId: string; amount: string }

type SaleFormProps = SaleFormData & { canManage: boolean }

const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 })
const usd = (value: number) => formatMoney(value, "USD")

const readStoredChannel = (): SaleChannel => {
  try {
    const stored = localStorage.getItem(LAST_CHANNEL_STORAGE_KEY)
    return MANUAL_CHANNELS.includes(stored as SaleChannel) ? (stored as SaleChannel) : "in_person"
  } catch {
    return "in_person"
  }
}

const PAYMENT_MODES = [
  { value: "full", label: "Pagó todo" },
  { value: "custom", label: "Abono o mixto" },
  { value: "none", label: "Por cobrar" },
] as const

// Registrar una venta en una sola pantalla, pensada para el celular.
const SaleForm = ({
  variants,
  methods,
  rates,
  staffMaxDiscountPercent,
  staffMaxBackdateDays,
  today,
  canManage,
}: SaleFormProps) => {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [cart, setCart] = useState<CartLine[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [priceMethodId, setPriceMethodId] = useState(methods[0]?.id ?? "")
  const [customer, setCustomer] = useState<PickedCustomer | null>(null)
  const [channel, setChannel] = useState<SaleChannel>("in_person")
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("pickup")
  const [deliveryFee, setDeliveryFee] = useState("")
  const [showDiscount, setShowDiscount] = useState(false)
  const [discountType, setDiscountType] = useState<DiscountType>("percent")
  const [discountValue, setDiscountValue] = useState("")
  const [discountReason, setDiscountReason] = useState("")
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("full")
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([])
  const [delivered, setDelivered] = useState(true)
  const [notes, setNotes] = useState("")
  // Fecha de la venta: hoy, o una pasada con las tasas de ese día.
  const [date, setDate] = useState(today)
  const [dateRates, setDateRates] = useState<SaleRatesForDate | "today">("today")
  const isBackdated = date !== today

  // El canal se recuerda por dispositivo (se lee después de montar para no romper la hidratación).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de localStorage
    setChannel(readStoredChannel())
  }, [])

  const variantById = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants])
  const methodById = useMemo(() => new Map(methods.map((m) => [m.id, m])), [methods])
  const priceMethod = methodById.get(priceMethodId)

  // ---- Totales (mismas reglas que la base) ----
  const lines = cart.map((line) => {
    const variant = variantById.get(line.variantId)!
    const price = variant.pricesUsd[priceMethodId]
    return { ...line, variant, price, total: price === undefined ? 0 : lineTotal(price, line.quantity) }
  })
  const missingPrice = lines.filter((l) => l.price === undefined)
  const shortStock = lines.filter((l) => l.source === "stock" && l.quantity > l.variant.stock)
  const subtotal = round(lines.reduce((sum, l) => sum + l.total, 0))
  const parsedDiscount = showDiscount ? (parseAmount(discountValue) ?? 0) : 0
  const discount = Math.min(discountUsd(subtotal, discountType, parsedDiscount), subtotal)
  const fee = deliveryMethod === "delivery" ? (parseAmount(deliveryFee) ?? 0) : 0
  const total = round(subtotal - discount + fee)
  const overDiscountLimit = !canManage && discountPercent(subtotal, discount) > staffMaxDiscountPercent + 0.0001

  const saleRates =
    dateRates === "today"
      ? (rates ?? { bcvUsd: 0, bcvEur: 0, usdUsdt: 1, isCurrent: false })
      : { bcvUsd: 0, bcvEur: 0, usdUsdt: 1, ...dateRates, isCurrent: dateRates !== null }
  const needsCurrentRate = (m: SalePaymentMethod | undefined) => Boolean(m && m.rateKind !== "none")
  const inMethodCurrency = (m: SalePaymentMethod, amountUsd: number) => usdToMethodAmount(amountUsd, m, saleRates)

  // Pagos que se enviarán.
  const payments =
    paymentMode === "full" && priceMethod && total > 0
      ? [{ methodId: priceMethod.id, amount: inMethodCurrency(priceMethod, total) }]
      : paymentMode === "custom"
        ? paymentRows.flatMap((row) => {
            const amount = parseAmount(row.amount)
            return amount && amount > 0 ? [{ methodId: row.methodId, amount }] : []
          })
        : []
  const paidUsd = round(
    payments.reduce((sum, p) => sum + methodAmountToUsd(p.amount, methodById.get(p.methodId)!, saleRates), 0),
    6
  )
  const balance = Math.max(round(total - paidUsd), 0)
  const overpaid = paidUsd > total + 0.01
  const bsWithoutRate =
    !isBackdated && payments.some((p) => needsCurrentRate(methodById.get(p.methodId)) && !rates?.isCurrent)
  const backdateWithoutRate = isBackdated && dateRates === null

  const blockers = [
    cart.length === 0 && SALES_MESSAGES.EMPTY_CART,
    missingPrice[0] && SALES_MESSAGES.NO_PRICE(missingPrice[0].variant.productName, priceMethod?.name ?? ""),
    shortStock[0] && `No hay suficiente "${shortStock[0].variant.productName}" (${shortStock[0].variant.sku}) en inventario.`,
    overDiscountLimit && `El descuento máximo sin owner o admin es ${staffMaxDiscountPercent}%.`,
    showDiscount && discount > 0 && !discountReason.trim() && "Indica el motivo del descuento.",
    overpaid && "Los pagos superan el total.",
    bsWithoutRate && "Falta la tasa BCV de hoy para cobrar en Bs.",
    backdateWithoutRate && "No hay tasas registradas para esa fecha. Owner o admin debe cargarlas.",
  ].filter(Boolean) as string[]

  // ---- Carrito ----
  const addVariant = (variant: SellableVariant) => {
    setPickerOpen(false)
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id)
      if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l))
      const source: SaleLineSource =
        variant.fulfillmentType === "made_to_order" || (variant.fulfillmentType === "both" && variant.stock < 1)
          ? "made_to_order"
          : "stock"
      return [...prev, { variantId: variant.id, quantity: 1, source }]
    })
  }
  const setQuantity = (variantId: string, quantity: number) =>
    setCart((prev) =>
      quantity <= 0 ? prev.filter((l) => l.variantId !== variantId) : prev.map((l) => (l.variantId === variantId ? { ...l, quantity } : l))
    )
  const toggleSource = (variantId: string) =>
    setCart((prev) =>
      prev.map((l) => (l.variantId === variantId ? { ...l, source: l.source === "stock" ? "made_to_order" : "stock" } : l))
    )

  const addPaymentRow = () => {
    const method = priceMethod ?? methods[0]
    setPaymentRows((rows) => [
      ...rows,
      { key: Date.now(), methodId: method.id, amount: balance > 0 ? String(inMethodCurrency(method, balance)) : "" },
    ])
  }

  const changeChannel = (value: SaleChannel) => {
    setChannel(value)
    setDelivered(value === "in_person" && deliveryMethod === "pickup")
    try {
      localStorage.setItem(LAST_CHANNEL_STORAGE_KEY, value)
    } catch {
      // Sin almacenamiento: se usa el valor por defecto la próxima vez.
    }
  }

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const result = await createSaleAction({
        channel,
        price_method_id: priceMethodId,
        delivery_method: deliveryMethod,
        customer_id: customer?.id ?? null,
        items: cart.map((l) => ({ variant_id: l.variantId, quantity: l.quantity, source: l.source })),
        payments: payments.map((p) => ({ payment_method_id: p.methodId, amount: p.amount })),
        delivery_fee_usd: fee,
        discount_type: showDiscount && discount > 0 ? discountType : null,
        discount_value: showDiscount && discount > 0 ? parsedDiscount : null,
        discount_reason: showDiscount && discount > 0 ? discountReason : null,
        notes: notes.trim() || null,
        delivered,
        date: isBackdated ? date : undefined,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(SALES_MESSAGES.CREATED)
      router.push(ROUTES.SALE(result.saleId))
    })
  }

  if (methods.length === 0) {
    return <StatusAlert tone="warning" title="No hay métodos de pago activos. Owner o admin debe crearlos primero." />
  }

  return (
    <div className="grid gap-5">
      {/* 1. Productos */}
      <section className="grid gap-2">
        <Label>Productos</Label>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-11 justify-start font-normal text-muted-foreground md:h-9">
              <PackagePlusIcon aria-hidden />
              Buscar por nombre, color, talla o SKU
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Filipina negra M…" />
              <CommandList>
                <CommandEmpty>No hay coincidencias.</CommandEmpty>
                <CommandGroup>
                  {variants.map((variant) => {
                    const price = variant.pricesUsd[priceMethodId]
                    return (
                      <CommandItem
                        key={variant.id}
                        value={`${variant.productName} ${variant.variantLabel} ${variant.sku}`}
                        onSelect={() => addVariant(variant)}
                      >
                        <span className="grid min-w-0 flex-1">
                          <span className="truncate">
                            {variant.productName} <span className="text-muted-foreground">· {variant.variantLabel}</span>
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">{variant.sku}</span>
                        </span>
                        <span className="grid justify-items-end text-xs tabular-nums">
                          <span>{price === undefined ? "Sin precio" : usd(price)}</span>
                          <span className="text-muted-foreground">
                            {variant.fulfillmentType === "made_to_order"
                              ? "Por encargo"
                              : `Hay ${quantityFormat.format(variant.stock)}`}
                          </span>
                        </span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {lines.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {lines.map((line) => (
              <li key={line.variantId} className="grid gap-2 p-3">
                <div className="flex items-start gap-2">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="text-sm font-medium">
                      {line.variant.productName}{" "}
                      <span className="font-normal text-muted-foreground">· {line.variant.variantLabel}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {line.price === undefined ? (
                        <StatusBadge tone="error">Sin precio para {priceMethod?.name}</StatusBadge>
                      ) : (
                        <>
                          {usd(line.price)} c/u
                          {line.source === "stock" && ` · hay ${quantityFormat.format(line.variant.stock)}`}
                        </>
                      )}
                    </span>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{usd(line.total)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-md border">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10 md:size-8"
                      onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                    >
                      {line.quantity === 1 ? <Trash2Icon aria-hidden /> : <MinusIcon aria-hidden />}
                      <span className="sr-only">{line.quantity === 1 ? "Quitar" : "Uno menos"}</span>
                    </Button>
                    <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
                      {quantityFormat.format(line.quantity)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10 md:size-8"
                      onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                    >
                      <PlusIcon aria-hidden />
                      <span className="sr-only">Uno más</span>
                    </Button>
                  </div>
                  {line.variant.fulfillmentType === "both" ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => toggleSource(line.variantId)}>
                      {SOURCE_LABELS[line.source]}
                      <span className="sr-only">(cambiar)</span>
                    </Button>
                  ) : (
                    line.source === "made_to_order" && <StatusBadge tone="info">Por encargo</StatusBadge>
                  )}
                  {line.source === "stock" && line.quantity > line.variant.stock && (
                    <StatusBadge tone="error">Stock insuficiente</StatusBadge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2. Método de pago (lista de precios) */}
      <FormField label="Método de pago" htmlFor="sale-method" hint="Define el precio de cada producto.">
        <ChoiceChips
          id="sale-method"
          label="Método de pago"
          value={priceMethodId}
          onChange={setPriceMethodId}
          options={methods.map((m) => ({ value: m.id, label: m.name }))}
        />
      </FormField>

      {/* 3. Cliente */}
      <div className="grid gap-2">
        <Label>
          Cliente <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <CustomerPicker value={customer} onChange={setCustomer} canManage={canManage} emptyLabel="Sin cliente (venta rápida)" />
      </div>

      {/* 4. Canal y entrega */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Canal" htmlFor="sale-channel">
          <ChoiceChips
            id="sale-channel"
            label="Canal"
            value={channel}
            onChange={(v) => changeChannel(v as SaleChannel)}
            options={MANUAL_CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))}
          />
        </FormField>
        <FormField label="Entrega" htmlFor="sale-delivery">
          <ChoiceChips
            id="sale-delivery"
            label="Entrega"
            value={deliveryMethod}
            onChange={(v) => {
              setDeliveryMethod(v as DeliveryMethod)
              setDelivered(channel === "in_person" && v === "pickup")
            }}
            options={(["pickup", "delivery"] as const).map((d) => ({ value: d, label: DELIVERY_LABELS[d] }))}
          />
        </FormField>
      </div>
      {deliveryMethod === "delivery" && (
        <FormField label="Cobro de delivery (USD)" htmlFor="sale-fee" optional hint="Se suma al total de la venta.">
          <Input
            id="sale-fee"
            inputMode="decimal"
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            placeholder="0"
            className="h-11 md:h-9"
          />
        </FormField>
      )}

      {/* 5. Descuento */}
      {showDiscount ? (
        <div className="grid gap-3 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <Label>Descuento</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowDiscount(false)}>
              Quitar
            </Button>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <ChoiceChips
              label="Tipo de descuento"
              value={discountType}
              onChange={(v) => setDiscountType(v as DiscountType)}
              options={[
                { value: "percent", label: "%" },
                { value: "amount", label: "USD" },
              ]}
            />
            <Input
              aria-label="Valor del descuento"
              inputMode="decimal"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === "percent" ? "10" : "5"}
              className="h-11 md:h-9"
            />
          </div>
          <Input
            aria-label="Motivo del descuento"
            value={discountReason}
            onChange={(e) => setDiscountReason(e.target.value)}
            placeholder="Motivo (obligatorio)"
            className="h-11 md:h-9"
          />
          {!canManage && (
            <p className="text-xs text-muted-foreground">Hasta {staffMaxDiscountPercent}% sin owner o admin.</p>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-fit justify-start px-0 text-muted-foreground"
          onClick={() => setShowDiscount(true)}
        >
          <PlusIcon aria-hidden />
          Agregar descuento
        </Button>
      )}

      {/* 6. Pago */}
      <FormField label="Pago" htmlFor="sale-payment">
        <ChoiceChips
          id="sale-payment"
          label="Pago"
          value={paymentMode}
          onChange={(v) => {
            setPaymentMode(v as PaymentMode)
            if (v === "custom" && paymentRows.length === 0) addPaymentRow()
          }}
          options={PAYMENT_MODES}
        />
      </FormField>
      {paymentMode === "custom" && (
        <div className="grid gap-2">
          {paymentRows.map((row) => {
            const method = methodById.get(row.methodId)!
            return (
              <div key={row.key} className="grid grid-cols-[1fr_8rem_auto] gap-2">
                <select
                  aria-label="Método del pago"
                  value={row.methodId}
                  onChange={(e) =>
                    setPaymentRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, methodId: e.target.value } : r)))
                  }
                  className="h-11 rounded-md border bg-background px-2 text-sm md:h-9"
                >
                  {methods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <Input
                  aria-label={`Monto en ${method.currency}`}
                  inputMode="decimal"
                  value={row.amount}
                  onChange={(e) =>
                    setPaymentRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, amount: e.target.value } : r)))
                  }
                  placeholder={method.currency}
                  className="h-11 text-right tabular-nums md:h-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 md:size-9"
                  onClick={() => setPaymentRows((rows) => rows.filter((r) => r.key !== row.key))}
                >
                  <Trash2Icon aria-hidden />
                  <span className="sr-only">Quitar pago</span>
                </Button>
              </div>
            )
          })}
          {paymentRows.length < 5 && (
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addPaymentRow}>
              <PlusIcon aria-hidden />
              Otro pago{balance > 0 ? ` (resta ${usd(balance)})` : ""}
            </Button>
          )}
        </div>
      )}

      {/* Notas y entrega inmediata */}
      <details className="group rounded-lg border p-3" open={isBackdated || undefined}>
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
          {isBackdated ? `Fecha: ${date.split("-").reverse().join("/")}` : "Más opciones (fecha, notas)"}
          <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-3 grid gap-3">
          <BackdateField
            id="sale-date"
            today={today}
            maxDaysBack={canManage ? null : staffMaxBackdateDays}
            value={date}
            onChange={(next, nextRates) => {
              setDate(next)
              setDateRates(nextRates)
            }}
          />
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Ya se entregó
              <span className="block text-xs text-muted-foreground">Las líneas de inventario quedan como entregadas.</span>
            </span>
            <Switch checked={delivered} onCheckedChange={setDelivered} />
          </label>
          <Input
            aria-label="Notas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas (opcional)"
            className="h-11 md:h-9"
          />
        </div>
      </details>

      {/* Resumen y registrar */}
      <div className="sticky bottom-0 -mx-4 grid gap-3 border-t bg-background p-4 md:static md:mx-0 md:rounded-lg md:border">
        <dl className="grid gap-1 text-sm tabular-nums">
          {(discount > 0 || fee > 0) && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Subtotal</dt>
              <dd>{usd(subtotal)}</dd>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Descuento</dt>
              <dd>−{usd(discount)}</dd>
            </div>
          )}
          {fee > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Delivery</dt>
              <dd>{usd(fee)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd>{usd(total)}</dd>
          </div>
          {priceMethod && priceMethod.rateKind !== "none" && total > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>En Bs (tasa {formatRate(priceMethod.rateKind === "bcv_eur" ? saleRates.bcvEur : saleRates.bcvUsd)})</dt>
              <dd>{formatMoney(inMethodCurrency(priceMethod, total), "VES")}</dd>
            </div>
          )}
          {paymentMode !== "full" && total > 0 && (
            <div className="flex justify-between">
              <dt>{isSettled(total - paidUsd) ? "Pagado completo" : "Queda por cobrar"}</dt>
              <dd>{isSettled(total - paidUsd) ? <CheckIcon className="size-4" aria-hidden /> : usd(balance)}</dd>
            </div>
          )}
        </dl>

        {error ? (
          <StatusAlert tone="error" title={error} />
        ) : (
          cart.length > 0 && blockers[0] && <StatusAlert tone="warning" title={blockers[0]} />
        )}

        <Button type="button" className={cn("h-12 text-base")} disabled={pending || blockers.length > 0} onClick={submit}>
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          {pending ? "Registrando…" : `Registrar venta${isBackdated ? " retroactiva" : ""} · ${usd(total)}`}
        </Button>
      </div>
    </div>
  )
}

export default SaleForm

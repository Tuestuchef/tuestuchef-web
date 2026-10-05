"use client"

import { Loader2Icon, MinusIcon, PackagePlusIcon, PaletteIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import ChoiceChips from "@/common/components/choice-chips"
import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import StatusBadge from "@/common/components/status-badge"
import { Button } from "@/common/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/common/components/ui/command"
import { Input } from "@/common/components/ui/input"
import { Label } from "@/common/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/common/components/ui/popover"
import { Switch } from "@/common/components/ui/switch"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"
import CustomerPicker, { type PickedCustomer } from "@/modules/customers/components/customer-picker"
import ComboPickerDialog, { type ComboSelection } from "@/modules/sales/components/combo-picker-dialog"
import { CHANNEL_LABELS, DELIVERY_LABELS, MANUAL_CHANNELS, type DeliveryMethod, type SaleChannel } from "@/modules/sales/lib/constants/sales.constants"
import type { SellableVariant } from "@/modules/sales/lib/types/sales.types"
import { lineTotal, round, usdToMethodAmount, volumePercent } from "@/modules/sales/lib/utils/sale-math.util"

import { createOrderAction } from "../lib/actions/orders.action"
import { STOCK_MODE_LABELS, type OrderStockMode } from "../lib/constants/orders.constants"
import type { OrderFormData } from "../lib/types/orders.types"
import CustomizationDialog, { type LineCustomization } from "./customization-dialog"

type OrderLine = {
  key: string
  variantId: string
  quantity: number
  components?: ComboSelection["components"]
  customizations: LineCustomization[]
}

type PaymentRow = { key: number; methodId: string; amount: string }

const usd = (value: number) => formatMoney(value, "USD")
const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

// Registrar un pedido: cliente, productos con su personalización, modo de stock, fecha y abono.
const OrderForm = ({
  variants,
  methods,
  rates,
  volumeTiers,
  customizationTypes,
  customizationTiers,
  settings,
  vatPercent,
  today,
  canManage,
  storageEnabled,
}: OrderFormData & { canManage: boolean; storageEnabled: boolean }) => {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<OrderLine[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [comboToPick, setComboToPick] = useState<SellableVariant | null>(null)
  const [customizing, setCustomizing] = useState<string | null>(null)
  const [customer, setCustomer] = useState<PickedCustomer | null>(null)
  const [priceMethodId, setPriceMethodId] = useState(methods[0]?.id ?? "")
  const [channel, setChannel] = useState<SaleChannel>("whatsapp")
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("pickup")
  const [deliveryFee, setDeliveryFee] = useState("")
  const [stockMode, setStockMode] = useState<OrderStockMode>("reserve_and_produce")
  const [promisedDate, setPromisedDate] = useState(addDays(today, settings.defaultLeadDays))
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [notes, setNotes] = useState("")
  const [vatEnabled, setVatEnabled] = useState(false)

  const variantById = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants])
  const typeById = useMemo(() => new Map(customizationTypes.map((t) => [t.id, t])), [customizationTypes])
  const methodById = useMemo(() => new Map(methods.map((m) => [m.id, m])), [methods])
  const saleRates = rates ?? { bcvUsd: 0, bcvEur: 0, usdUsdt: 1 }

  // ---- Totales (la base vuelve a calcular todo) ----
  const priced = lines.map((line) => {
    const variant = variantById.get(line.variantId)!
    const price = variant.pricesUsd[priceMethodId]
    return { ...line, variant, price, total: price === undefined ? 0 : lineTotal(price, line.quantity) }
  })
  const productsSubtotal = round(priced.reduce((sum, l) => sum + l.total, 0))
  const pieces = lines.reduce((sum, l) => sum + (l.components ? l.components.reduce((s, c) => s + c.quantity, 0) : l.quantity), 0)
  const volume = round((productsSubtotal * volumePercent(volumeTiers, pieces)) / 100)

  const perType = new Map<string, number>()
  for (const line of lines) for (const c of line.customizations) perType.set(c.typeId, (perType.get(c.typeId) ?? 0) + c.quantity)
  const customizationTotal = round(
    [...perType].reduce((sum, [typeId, qty]) => {
      const type = typeById.get(typeId)
      const pct = volumePercent(customizationTiers, qty)
      return sum + round(qty * (type?.unitPriceUsd ?? 0) * (1 - pct / 100))
    }, 0)
  )
  const belowMinimum = [...perType].flatMap(([typeId, qty]) => {
    const type = typeById.get(typeId)
    return type && qty < type.minQuantity ? [`"${type.name}" es desde ${type.minQuantity} piezas (van ${qty}).`] : []
  })
  const fee = deliveryMethod === "delivery" ? (parseAmount(deliveryFee) ?? 0) : 0
  // IVA sobre lo que queda después de descuentos, sin el delivery (como la base).
  const vat = vatEnabled ? round(((productsSubtotal + customizationTotal - volume) * vatPercent) / 100) : 0
  const total = round(productsSubtotal + customizationTotal - volume + fee + vat)
  const depositRequired = total >= settings.depositThresholdUsd ? round((total * settings.depositPercent) / 100) : total
  const paymentsToSend = payments.flatMap((p) => {
    const amount = parseAmount(p.amount)
    return amount && amount > 0 ? [{ payment_method_id: p.methodId, amount }] : []
  })
  const paidUsd = round(
    paymentsToSend.reduce((sum, p) => {
      const method = methodById.get(p.payment_method_id)!
      return sum + p.amount / usdToMethodAmount(1, method, saleRates)
    }, 0)
  )

  const missingPrice = priced.find((l) => l.price === undefined)
  const blockers = [
    !customer && "Elige el cliente: un pedido necesita cliente.",
    customer?.blockedReason && `Cliente bloqueado: no se le puede vender (${customer.blockedReason}).`,
    lines.length === 0 && "Agrega al menos un producto.",
    missingPrice && `"${missingPrice.variant.productName}" no tiene precio para ${methodById.get(priceMethodId)?.name ?? ""}.`,
    belowMinimum[0],
    paidUsd > total + 0.01 && "Los pagos superan el total.",
    promisedDate < today && "La fecha prometida no puede ser pasada.",
  ].filter(Boolean) as string[]

  const addVariant = (variant: SellableVariant) => {
    setPickerOpen(false)
    if (variant.components) {
      setComboToPick(variant)
      return
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id && !l.components)
      if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l))
      return [...prev, { key: `${variant.id}-${Date.now()}`, variantId: variant.id, quantity: 1, customizations: [] }]
    })
  }
  const setQuantity = (key: string, quantity: number) =>
    setLines((prev) => (quantity <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, quantity } : l))))
  const customizingLine = priced.find((l) => l.key === customizing)

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const result = await createOrderAction({
        customer_id: customer?.id,
        price_method_id: priceMethodId,
        channel,
        delivery_method: deliveryMethod,
        stock_mode: stockMode,
        promised_date: promisedDate,
        items: lines.map((l) => ({
          variant_id: l.variantId,
          quantity: l.quantity,
          ...(l.components && {
            components: l.components.map((c) => ({ variant_id: c.variantId, quantity: c.quantity, source: c.source })),
          }),
          customizations: l.customizations.map((c) => ({
            type_id: c.typeId,
            quantity: c.quantity,
            text: c.text,
            names: c.names,
            logo_path: c.logoPath,
            position: c.position,
            size_cm: c.sizeCm,
            note: c.note,
          })),
        })),
        payments: paymentsToSend,
        delivery_fee_usd: fee,
        vat_enabled: vatEnabled,
        notes: notes.trim() || null,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success("Pedido registrado.")
      router.push(ROUTES.ORDER(result.saleId))
    })
  }

  return (
    <div className="grid gap-5">
      {/* Cliente */}
      <div className="grid gap-2">
        <Label>Cliente</Label>
        <CustomerPicker value={customer} onChange={setCustomer} canManage={canManage} emptyLabel="Elige el cliente" />
        {customer?.blockedReason && <StatusAlert tone="error" title={`Cliente bloqueado: ${customer.blockedReason}`} />}
      </div>

      {/* Productos */}
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
                  {variants.map((variant) => (
                    <CommandItem key={variant.id} value={`${variant.productName} ${variant.variantLabel} ${variant.sku}`} onSelect={() => addVariant(variant)}>
                      <span className="grid min-w-0 flex-1">
                        <span className="truncate">
                          {variant.productName} <span className="text-muted-foreground">· {variant.variantLabel}</span>
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{variant.sku}</span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {variant.components ? "Combo" : variant.fulfillmentType === "made_to_order" ? "Por encargo" : `Hay ${variant.stock}`}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {priced.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {priced.map((line) => (
              <li key={line.key} className="grid gap-2 p-3">
                <div className="flex items-start gap-2">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="text-sm font-medium">
                      {line.variant.productName} <span className="font-normal text-muted-foreground">· {line.variant.variantLabel}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {line.price === undefined ? "Sin precio para este método" : `${usd(line.price)} c/u`}
                      {!line.components && line.variant.fulfillmentType !== "made_to_order" && ` · hay ${line.variant.stock} en inventario`}
                    </span>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{usd(line.total)}</span>
                </div>

                {line.components ? (
                  <div className="flex items-center gap-2">
                    <StatusBadge tone="info">
                      {line.quantity} {line.quantity === 1 ? "combo" : "combos"}
                    </StatusBadge>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setQuantity(line.key, 0)}>
                      <Trash2Icon aria-hidden />
                      Quitar
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center rounded-md border">
                      <Button type="button" variant="ghost" size="icon" className="size-10 md:size-8" onClick={() => setQuantity(line.key, line.quantity - 1)}>
                        {line.quantity === 1 ? <Trash2Icon aria-hidden /> : <MinusIcon aria-hidden />}
                        <span className="sr-only">Uno menos</span>
                      </Button>
                      <Input
                        aria-label="Cantidad"
                        inputMode="numeric"
                        value={line.quantity}
                        onChange={(e) => setQuantity(line.key, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                        className="h-10 w-14 border-0 text-center tabular-nums shadow-none md:h-8"
                      />
                      <Button type="button" variant="ghost" size="icon" className="size-10 md:size-8" onClick={() => setQuantity(line.key, line.quantity + 1)}>
                        <PlusIcon aria-hidden />
                        <span className="sr-only">Uno más</span>
                      </Button>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setCustomizing(line.key)}>
                      <PaletteIcon aria-hidden />
                      Personalizar
                    </Button>
                  </div>
                )}

                {line.customizations.length > 0 && (
                  <ul className="grid gap-1 border-l-2 pl-2 text-xs">
                    {line.customizations.map((c) => (
                      <li key={c.key} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate">
                          {c.quantity} × {typeById.get(c.typeId)?.name}
                          {c.names ? ` · ${c.names.length} nombres` : c.text ? ` · "${c.text}"` : ""}
                          {c.logoPath && " · logo"}
                          {c.sizeCm && ` · ${c.sizeCm} cm`}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() =>
                            setLines((prev) =>
                              prev.map((l) => (l.key === line.key ? { ...l, customizations: l.customizations.filter((x) => x.key !== c.key) } : l))
                            )
                          }
                        >
                          <XIcon aria-hidden />
                          <span className="sr-only">Quitar personalización</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Stock y fecha */}
      <FormField label="Inventario" htmlFor="order-stock">
        <ChoiceChips
          id="order-stock"
          label="Modo de inventario"
          value={stockMode}
          onChange={(v) => setStockMode(v as OrderStockMode)}
          options={(Object.keys(STOCK_MODE_LABELS) as OrderStockMode[]).map((mode) => ({ value: mode, label: STOCK_MODE_LABELS[mode].title }))}
        />
        <p className="text-xs text-muted-foreground">{STOCK_MODE_LABELS[stockMode].description}</p>
      </FormField>
      <FormField label="Fecha prometida" htmlFor="order-date" hint={`Por defecto, ${settings.defaultLeadDays} días.`}>
        <Input id="order-date" type="date" min={today} value={promisedDate} onChange={(e) => setPromisedDate(e.target.value)} className="h-11 md:h-9" />
      </FormField>

      {/* Precio, canal y entrega */}
      <FormField label="Lista de precios" htmlFor="order-method" hint="El método de pago define el precio de cada producto.">
        <ChoiceChips id="order-method" label="Lista de precios" value={priceMethodId} onChange={setPriceMethodId} options={methods.map((m) => ({ value: m.id, label: m.name }))} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Canal" htmlFor="order-channel">
          <ChoiceChips
            id="order-channel"
            label="Canal"
            value={channel}
            onChange={(v) => setChannel(v as SaleChannel)}
            options={MANUAL_CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))}
          />
        </FormField>
        <FormField label="Entrega" htmlFor="order-delivery">
          <ChoiceChips
            id="order-delivery"
            label="Entrega"
            value={deliveryMethod}
            onChange={(v) => setDeliveryMethod(v as DeliveryMethod)}
            options={(["pickup", "delivery"] as const).map((d) => ({ value: d, label: DELIVERY_LABELS[d] }))}
          />
        </FormField>
      </div>
      {deliveryMethod === "delivery" && (
        <FormField label="Cobro de delivery (USD)" htmlFor="order-fee" optional>
          <Input id="order-fee" inputMode="decimal" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} placeholder="0" className="h-11 md:h-9" />
        </FormField>
      )}

      {/* Abono */}
      <section className="grid gap-2">
        <Label>Pago inicial</Label>
        <p className="text-xs text-muted-foreground">
          {total >= settings.depositThresholdUsd
            ? `Desde ${usd(settings.depositThresholdUsd)}: ${settings.depositPercent}% para empezar (${usd(depositRequired)}) y el resto al entregar.`
            : `Menos de ${usd(settings.depositThresholdUsd)}: se paga completo para empezar.`}
        </p>
        {payments.map((row) => {
          const method = methodById.get(row.methodId)!
          return (
            <div key={row.key} className="grid grid-cols-[1fr_8rem_auto] gap-2">
              <select
                aria-label="Método del pago"
                value={row.methodId}
                onChange={(e) => setPayments((rows) => rows.map((r) => (r.key === row.key ? { ...r, methodId: e.target.value } : r)))}
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
                onChange={(e) => setPayments((rows) => rows.map((r) => (r.key === row.key ? { ...r, amount: e.target.value } : r)))}
                placeholder={method.currency}
                className="h-11 text-right tabular-nums md:h-9"
              />
              <Button type="button" variant="ghost" size="icon" className="size-11 md:size-9" onClick={() => setPayments((rows) => rows.filter((r) => r.key !== row.key))}>
                <Trash2Icon aria-hidden />
                <span className="sr-only">Quitar pago</span>
              </Button>
            </div>
          )
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={total <= 0}
          onClick={() => {
            const method = methodById.get(priceMethodId) ?? methods[0]
            const missing = Math.max(depositRequired - paidUsd, 0)
            setPayments((rows) => [...rows, { key: Date.now(), methodId: method.id, amount: missing > 0 ? String(usdToMethodAmount(missing, method, saleRates)) : "" }])
          }}
        >
          <PlusIcon aria-hidden />
          Agregar pago{paidUsd < depositRequired ? ` (faltan ${usd(depositRequired - paidUsd)} para empezar)` : ""}
        </Button>
      </section>

      {vatPercent > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="grid gap-0.5">
            <Label htmlFor="order-vat">Agregar IVA ({vatPercent}%)</Label>
            <p className="text-xs text-muted-foreground">Se suma al total, después de descuentos y sin el delivery.</p>
          </div>
          <Switch id="order-vat" checked={vatEnabled} onCheckedChange={setVatEnabled} />
        </div>
      )}

      <FormField label="Notas" htmlFor="order-notes" optional>
        <Input id="order-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Entregar en la cocina" className="h-11 md:h-9" />
      </FormField>

      {/* Resumen */}
      <div className="sticky bottom-0 -mx-4 grid gap-3 border-t bg-background p-4 md:static md:mx-0 md:rounded-lg md:border">
        <dl className="grid gap-1 text-sm tabular-nums">
          <div className="flex justify-between text-muted-foreground">
            <dt>Productos</dt>
            <dd>{usd(productsSubtotal)}</dd>
          </div>
          {customizationTotal > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Personalización</dt>
              <dd>{usd(customizationTotal)}</dd>
            </div>
          )}
          {volume > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Al mayor ({pieces} piezas)</dt>
              <dd>−{usd(volume)}</dd>
            </div>
          )}
          {fee > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Delivery</dt>
              <dd>{usd(fee)}</dd>
            </div>
          )}
          {vat > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>IVA {vatPercent}%</dt>
              <dd>{usd(vat)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd>{usd(total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Para empezar a producir</dt>
            <dd>{usd(depositRequired)}</dd>
          </div>
          {paidUsd > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Pagado ahora</dt>
              <dd>{usd(paidUsd)}</dd>
            </div>
          )}
        </dl>
        {error ? <StatusAlert tone="error" title={error} /> : lines.length > 0 && blockers[0] && <StatusAlert tone="warning" title={blockers[0]} />}
        {paidUsd + 0.01 < depositRequired && lines.length > 0 && (
          <p className="text-xs text-muted-foreground">Sin el pago inicial, el pedido queda registrado pero no se empieza a producir.</p>
        )}
        <Button type="button" className="h-12 text-base" disabled={pending || blockers.length > 0} onClick={submit}>
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          {pending ? "Registrando…" : `Registrar pedido · ${usd(total)}`}
        </Button>
      </div>

      <ComboPickerDialog
        combo={comboToPick}
        variants={variants}
        available={(id) => variantById.get(id)?.stock ?? 0}
        onCancel={() => setComboToPick(null)}
        onConfirm={(selection) => {
          const combo = comboToPick
          setComboToPick(null)
          if (!combo) return
          setLines((prev) => [
            ...prev,
            { key: `${combo.id}-${Date.now()}`, variantId: combo.id, quantity: selection.quantity, components: selection.components, customizations: [] },
          ])
        }}
      />
      <CustomizationDialog
        key={customizing ?? "none"}
        open={Boolean(customizingLine)}
        lineLabel={customizingLine ? `${customizingLine.quantity} × ${customizingLine.variant.productName} · ${customizingLine.variant.variantLabel}` : ""}
        lineQuantity={customizingLine?.quantity ?? 1}
        types={customizationTypes}
        storageEnabled={storageEnabled}
        onClose={() => setCustomizing(null)}
        onSave={(c) => {
          setLines((prev) => prev.map((l) => (l.key === customizing ? { ...l, customizations: [...l.customizations, c] } : l)))
          setCustomizing(null)
        }}
      />
    </div>
  )
}

export default OrderForm

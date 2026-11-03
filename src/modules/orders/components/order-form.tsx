"use client"

import {
  HandCoinsIcon,
  PaletteIcon,
  PercentIcon,
  PlusIcon,
  ShoppingBagIcon,
  Trash2Icon,
  TruckIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import ChoiceChips from "@/common/components/choice-chips"
import DateField from "@/common/components/date-field"
import FormField from "@/common/components/form-field"
import { type FormStep, FormStepPanel, FormStepper, FormStepperFooter } from "@/common/components/form-stepper"
import QuantityStepper from "@/common/components/quantity-stepper"
import StatusAlert from "@/common/components/status-alert"
import StatusBadge from "@/common/components/status-badge"
import { Button } from "@/common/components/ui/button"
import { Input } from "@/common/components/ui/input"
import { Label } from "@/common/components/ui/label"
import { Switch } from "@/common/components/ui/switch"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { useFormSteps } from "@/common/lib/hooks/use-form-steps.hook"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"
import CustomerPicker, { type PickedCustomer } from "@/modules/customers/components/customer-picker"
import BackdateField from "@/modules/sales/components/backdate-field"
import ComboPickerDialog, { type ComboSelection } from "@/modules/sales/components/combo-picker-dialog"
import PaymentRows, { type PaymentRow } from "@/modules/sales/components/payment-rows"
import ProductPicker from "@/modules/sales/components/product-picker"
import { useCustomerPricing } from "@/modules/sales/lib/hooks/use-customer-pricing.hook"
import { methodsForCustomer } from "@/modules/sales/lib/utils/agreement-pricing.util"
import {
  CHANNEL_LABELS,
  chargesShipping,
  DELIVERY_LABELS,
  DELIVERY_METHODS,
  MANUAL_CHANNELS,
  SHIPPING_FEE_LABELS,
  type DeliveryMethod,
  type SaleChannel,
} from "@/modules/sales/lib/constants/sales.constants"
import type { SaleRatesForDate, SellableVariant } from "@/modules/sales/lib/types/sales.types"
import { comboExtraUsd } from "@/modules/sales/lib/utils/combo.util"
import { lineTotal, round, usdToMethodAmount, volumePercent } from "@/modules/sales/lib/utils/sale-math.util"

import { createOrderAction } from "../lib/actions/orders.action"
import { STOCK_MODE_LABELS, type OrderStockMode } from "../lib/constants/orders.constants"
import type { OrderFormData } from "../lib/types/orders.types"
import { customizationPayload, customizingTarget, lineCustomizations, pieceTarget } from "../lib/utils/customization.util"
import CustomizationDialog, { type LineCustomization } from "./customization-dialog"
import CustomizationList from "./customization-list"

// Una pieza de un combo, con su personalización.
type ComboPiece = ComboSelection["components"][number] & { customizations: LineCustomization[] }

type OrderLine = {
  key: string
  variantId: string
  quantity: number
  components?: ComboPiece[]
  // En un combo, la personalización va en cada pieza (components).
  customizations: LineCustomization[]
}


const usd = (value: number) => formatMoney(value, "USD")
const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

// Los pasos: primero el cliente y la lista de precios (el acuerdo cambia precios y productos).
const ORDER_STEPS: FormStep[] = [
  { title: "Cliente", icon: UserRoundIcon },
  { title: "Productos", icon: ShoppingBagIcon },
  { title: "Entrega", icon: TruckIcon },
  { title: "Inicial", icon: HandCoinsIcon },
]
const [CUSTOMER_STEP, PRODUCTS_STEP, DELIVERY_STEP, DEPOSIT_STEP] = [0, 1, 2, 3]

// Registrar un pedido por pasos: cliente, productos con su personalización, entrega y abono.
const OrderForm = ({
  variants,
  methods,
  rates,
  volumeTiers: baseVolumeTiers,
  agreements,
  customizationTypes,
  customizationTiers,
  settings,
  vatPercent,
  today,
  staffMaxBackdateDays,
  canManage,
  storageEnabled,
}: OrderFormData & { canManage: boolean; storageEnabled: boolean }) => {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<OrderLine[]>([])
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
  // Otra inicial para este pedido (owner y admin). null = la que corresponde.
  const [depositInput, setDepositInput] = useState<string | null>(null)
  // Pedido de otro día: el pago inicial usa las tasas de ese día.
  const [date, setDate] = useState(today)
  const [dateRates, setDateRates] = useState<SaleRatesForDate | "today">("today")

  // Cliente con acuerdo: sus precios, sus exclusivos y sin descuento al mayor.
  const pricing = useCustomerPricing(variants, baseVolumeTiers, agreements, methods.map((m) => m.id), customer?.id ?? null)
  const volumeTiers = pricing.tiers
  const variantById = useMemo(() => new Map(pricing.priced.map((v) => [v.id, v])), [pricing.priced])
  const exclusiveLine = lines.find((l) => pricing.notAllowed(variantById.get(l.variantId)))
  const typeById = useMemo(() => new Map(customizationTypes.map((t) => [t.id, t])), [customizationTypes])
  // Cliente que paga sus Bs a tasa euro: sus métodos en Bs se calculan con la BCV euro (como la base).
  const ratedMethods = useMemo(() => methodsForCustomer(methods, pricing.agreement), [methods, pricing.agreement])
  const methodById = useMemo(() => new Map(ratedMethods.map((m) => [m.id, m])), [ratedMethods])
  const saleRates = dateRates === "today" ? (rates ?? { bcvUsd: 0, bcvEur: 0, usdUsdt: 1 }) : { bcvUsd: 0, bcvEur: 0, usdUsdt: 1, ...dateRates }
  const backdateWithoutRate = date !== today && dateRates === null

  // ---- Totales (la base vuelve a calcular todo) ----
  const priced = lines.map((line) => {
    const variant = variantById.get(line.variantId)!
    const price = variant.pricesUsd[priceMethodId]
    // Un combo suma el recargo de sus piezas (talla o color) encima de su precio.
    const extra = line.components ? comboExtraUsd(line.components, (id) => variantById.get(id)?.extraUsd) : 0
    return { ...line, variant, price, total: price === undefined ? 0 : round(lineTotal(price, line.quantity) + extra) }
  })
  const productsSubtotal = round(priced.reduce((sum, l) => sum + l.total, 0))
  const pieces = lines.reduce((sum, l) => sum + (l.components ? l.components.reduce((s, c) => s + c.quantity, 0) : l.quantity), 0)
  const volume = round((productsSubtotal * volumePercent(volumeTiers, pieces)) / 100)

  const perType = new Map<string, number>()
  // El mínimo cuenta todas las piezas personalizadas; el precio, solo las cobradas.
  const chargedPerType = new Map<string, number>()
  for (const line of lines)
    for (const c of lineCustomizations(line)) {
      perType.set(c.typeId, (perType.get(c.typeId) ?? 0) + c.quantity)
      if (c.charged) chargedPerType.set(c.typeId, (chargedPerType.get(c.typeId) ?? 0) + c.quantity)
    }
  const customizationTotal = round(
    [...chargedPerType].reduce((sum, [typeId, qty]) => {
      const type = typeById.get(typeId)
      const pct = volumePercent(customizationTiers, qty)
      return sum + round(qty * (type?.unitPriceUsd ?? 0) * (1 - pct / 100))
    }, 0)
  )
  const belowMinimum = [...perType].flatMap(([typeId, qty]) => {
    const type = typeById.get(typeId)
    return type && qty < type.minQuantity ? [`"${type.name}" es desde ${type.minQuantity} piezas (van ${qty}).`] : []
  })
  const fee = chargesShipping(deliveryMethod) ? (parseAmount(deliveryFee) ?? 0) : 0
  // IVA sobre lo que queda después de descuentos, sin el delivery (como la base).
  const vat = vatEnabled ? round(((productsSubtotal + customizationTotal - volume) * vatPercent) / 100) : 0
  const total = round(productsSubtotal + customizationTotal - volume + fee + vat)
  // Inicial: la que pone owner o admin; si no, desde el umbral la habitual del cliente o la de la regla; debajo, completo.
  const overThreshold = total >= settings.depositThresholdUsd
  const defaultDepositPercent = overThreshold ? (pricing.agreement?.depositPercent ?? settings.depositPercent) : 100
  const customDepositPercent = canManage && depositInput !== null ? parseAmount(depositInput) : null
  const depositPercentInvalid = customDepositPercent !== null && (customDepositPercent < 0 || customDepositPercent > 100)
  const depositPercent = customDepositPercent !== null && !depositPercentInvalid ? customDepositPercent : defaultDepositPercent
  const depositRequired = round((total * depositPercent) / 100)
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
  // Lo que impide seguir, por paso (en el último se revisan todos antes de registrar).
  const stepBlockers = [
    [
      !customer && "Elige el cliente: un pedido necesita cliente.",
      customer?.blockedReason && `Cliente bloqueado: no se le puede vender (${customer.blockedReason}).`,
    ],
    [
      lines.length === 0 && "Agrega al menos un producto.",
      exclusiveLine && `"${variantById.get(exclusiveLine.variantId)?.productName}" es exclusivo de otro cliente: quítalo o elige su cliente.`,
      missingPrice && `"${missingPrice.variant.productName}" no tiene precio para ${methodById.get(priceMethodId)?.name ?? ""}.`,
      belowMinimum[0],
    ],
    [
      promisedDate < today && "La fecha prometida no puede ser pasada.",
      backdateWithoutRate && "No hay tasas registradas para esa fecha. Owner o admin debe cargarlas.",
    ],
    [paidUsd > total + 0.01 && "Los pagos superan el total.", depositPercentInvalid && "La inicial va de 0 a 100%."],
  ].map((list) => list.filter(Boolean) as string[])
  const blockers = stepBlockers.flat()
  const steps = useFormSteps(ORDER_STEPS.length)
  // Primer paso con algo pendiente (para llevar ahí desde el último).
  const firstBlockedStep = stepBlockers.findIndex((list) => list.length > 0)

  // Una variante elegida (género, color y talla) con su cantidad; si ya está, suma.
  const addVariant = (variant: SellableVariant, quantity: number) =>
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id && !l.components)
      if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + quantity } : l))
      return [...prev, { key: `${variant.id}-${Date.now()}`, variantId: variant.id, quantity, customizations: [] }]
    })
  const setQuantity = (key: string, quantity: number) =>
    setLines((prev) => (quantity <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, quantity } : l))))
  // Lo que se está personalizando: una línea suelta o una pieza de un combo.
  const target = customizingTarget(customizing)
  const customizingLine = priced.find((l) => l.key === target?.lineKey)
  const customizingPiece = target?.pieceIndex != null ? customizingLine?.components?.[target.pieceIndex] : undefined
  const customizingPieceVariant = customizingPiece ? variantById.get(customizingPiece.variantId) : undefined
  const addCustomization = (c: LineCustomization) =>
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== target?.lineKey) return l
        if (target.pieceIndex === null) return { ...l, customizations: [...l.customizations, c] }
        return { ...l, components: l.components?.map((p, i) => (i === target.pieceIndex ? { ...p, customizations: [...p.customizations, c] } : p)) }
      })
    )
  const removeCustomization = (lineKey: string, pieceIndex: number | null, key: string) =>
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== lineKey) return l
        if (pieceIndex === null) return { ...l, customizations: l.customizations.filter((x) => x.key !== key) }
        return { ...l, components: l.components?.map((p, i) => (i === pieceIndex ? { ...p, customizations: p.customizations.filter((x) => x.key !== key) } : p)) }
      })
    )

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
        date,
        deposit_percent: customDepositPercent !== null && !depositPercentInvalid ? customDepositPercent : null,
        items: lines.map((l) => ({
          variant_id: l.variantId,
          quantity: l.quantity,
          ...(l.components && {
            components: l.components.map((c) => ({
              variant_id: c.variantId,
              quantity: c.quantity,
              source: c.source,
              customizations: c.customizations.map(customizationPayload),
            })),
          }),
          customizations: l.customizations.map(customizationPayload),
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

  // Resumen de lo elegido en un paso, con su botón para volver a cambiarlo.
  const reviewRow = (label: string, value: string, step: number) => (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="grid min-w-0 gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm">{value}</span>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={() => steps.goTo(step)}>
        Cambiar
      </Button>
    </div>
  )
  const currentBlockers = steps.isLast ? blockers : stepBlockers[steps.step]

  return (
    <div className="grid gap-5">
      <FormStepper steps={ORDER_STEPS} current={steps.step} reached={steps.reached} onSelect={steps.goTo} />

      {/* 1. Cliente y lista de precios: el acuerdo del cliente cambia precios y productos. */}
      {steps.step === CUSTOMER_STEP && (
        <FormStepPanel step={steps.step} direction={steps.direction}>
          <div className="grid gap-2">
            <Label>Cliente</Label>
            <CustomerPicker value={customer} onChange={setCustomer} canManage={canManage} emptyLabel="Elige el cliente" />
            {customer?.blockedReason && <StatusAlert tone="error" title={`Cliente bloqueado: ${customer.blockedReason}`} />}
          </div>
          {pricing.agreement && (
            <p className="rounded-lg border p-3 text-sm">
              Tiene acuerdo: sus precios especiales y sus productos exclusivos se aplican solos, sin descuento al mayor.
              {pricing.eurRate && " Paga sus Bs a tasa euro."}
              {pricing.agreement.depositPercent !== null && ` Su inicial habitual es ${pricing.agreement.depositPercent}%.`}
            </p>
          )}
          <FormField label="Lista de precios" htmlFor="order-method" hint="El método de pago define el precio de cada producto.">
            <ChoiceChips id="order-method" label="Lista de precios" value={priceMethodId} onChange={setPriceMethodId} options={methods.map((m) => ({ value: m.id, label: m.name }))} />
          </FormField>
        </FormStepPanel>
      )}

      {/* 2. Productos y su personalización */}
      {steps.step === PRODUCTS_STEP && (
        <FormStepPanel step={steps.step} direction={steps.direction} className="gap-2">
          <section className="grid gap-2">
            <Label>Productos</Label>
            <ProductPicker
              variants={pricing.visible}
              priceMethodId={priceMethodId}
              available={(id) => variantById.get(id)?.stock ?? 0}
              onAdd={addVariant}
              onCombo={setComboToPick}
            />

            {priced.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {priced.map((line) => (
                  <li key={line.key} className="grid gap-2 p-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200">
                    <div className="flex items-start gap-2">
                      <div className="grid min-w-0 flex-1 gap-0.5">
                        <span className="text-sm font-medium">
                          {line.variant.productName} <span className="font-normal text-muted-foreground">· {line.variant.variantLabel}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {line.price === undefined ? "Sin precio para este método" : `${usd(line.price)} c/u${line.variant.agreementPrice ? " · precio acuerdo" : ""}`}
                          {!line.components && line.variant.fulfillmentType !== "made_to_order" && ` · hay ${line.variant.stock} en inventario`}
                        </span>
                        {line.components && (
                          <ul className="mt-1 grid gap-0.5 border-l-2 pl-2 text-xs text-muted-foreground">
                            {line.components.map((c, index) => {
                              const piece = variantById.get(c.variantId)
                              return (
                                <li key={`${c.variantId}-${index}`} className="grid gap-1">
                                  <span className="flex flex-wrap items-center gap-x-2">
                                    <span>
                                      {c.quantity} × {piece?.productName} · {piece?.variantLabel}
                                      {piece && piece.extraUsd > 0 && ` · +${usd(round(piece.extraUsd * c.quantity))}`}
                                    </span>
                                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setCustomizing(pieceTarget(line.key, index))}>
                                      <PaletteIcon aria-hidden />
                                      Personalizar
                                    </Button>
                                  </span>
                                  <CustomizationList
                                    customizations={c.customizations}
                                    typeName={(id) => typeById.get(id)?.name}
                                    onRemove={(key) => removeCustomization(line.key, index, key)}
                                  />
                                </li>
                              )
                            })}
                          </ul>
                        )}
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
                        <QuantityStepper removable value={line.quantity} onChange={(q) => setQuantity(line.key, q)} />
                        <Button type="button" variant="outline" size="sm" onClick={() => setCustomizing(line.key)}>
                          <PaletteIcon aria-hidden />
                          Personalizar
                        </Button>
                      </div>
                    )}

                    <CustomizationList
                      customizations={line.customizations}
                      typeName={(id) => typeById.get(id)?.name}
                      onRemove={(key) => removeCustomization(line.key, null, key)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
          {pieces > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {pieces} {pieces === 1 ? "pieza" : "piezas"} · {usd(productsSubtotal + customizationTotal)}
              {volume > 0 && " · con descuento al mayor"}
            </p>
          )}
        </FormStepPanel>
      )}

      {/* 3. Entrega: inventario, fechas, canal, entrega y notas */}
      {steps.step === DELIVERY_STEP && (
        <FormStepPanel step={steps.step} direction={steps.direction}>
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
          <BackdateField
            id="order-occurred-date"
            today={today}
            maxDaysBack={canManage ? null : staffMaxBackdateDays}
            value={date}
            onChange={(next, nextRates) => {
              setDate(next)
              setDateRates(nextRates)
            }}
          />
          <FormField label="Fecha prometida" htmlFor="order-date" hint={`Por defecto, ${settings.defaultLeadDays} días.`}>
            <DateField id="order-date" min={today} value={promisedDate} onChange={setPromisedDate} />
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
                options={DELIVERY_METHODS.map((d) => ({ value: d, label: DELIVERY_LABELS[d] }))}
              />
            </FormField>
          </div>
          {chargesShipping(deliveryMethod) && (
            <FormField label={`Cobro de ${SHIPPING_FEE_LABELS[deliveryMethod].toLowerCase()} (USD)`} htmlFor="order-fee" optional>
              <Input id="order-fee" inputMode="decimal" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} placeholder="0" className="h-11 md:h-9" />
            </FormField>
          )}
          <FormField label="Notas" htmlFor="order-notes" optional>
            <Input id="order-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Entregar en la cocina" className="h-11 md:h-9" />
          </FormField>
        </FormStepPanel>
      )}

      {/* 4. Inicial: resumen, pago inicial e IVA */}
      {steps.step === DEPOSIT_STEP && (
        <FormStepPanel step={steps.step} direction={steps.direction}>
          <div className="divide-y rounded-lg border px-3">
            {reviewRow("Cliente y precios", `${customer?.name ?? "—"} · ${methodById.get(priceMethodId)?.name ?? ""}`, CUSTOMER_STEP)}
            {reviewRow("Productos", priced.map((l) => `${l.quantity} × ${l.variant.productName}`).join(", ") || "—", PRODUCTS_STEP)}
            {reviewRow(
              "Entrega",
              [
                STOCK_MODE_LABELS[stockMode].title,
                `para el ${promisedDate.split("-").reverse().join("/")}`,
                CHANNEL_LABELS[channel],
                DELIVERY_LABELS[deliveryMethod],
                date !== today && `pedido del ${date.split("-").reverse().join("/")}`,
              ]
                .filter(Boolean)
                .join(" · "),
              DELIVERY_STEP
            )}
          </div>
          <section className="grid gap-2">
            <Label>Pago inicial</Label>
            <p className="text-xs text-muted-foreground">
              {customDepositPercent !== null
                ? `Inicial pactada: ${depositPercent}% para empezar (${usd(depositRequired)}) y el resto al entregar.`
                : overThreshold
                  ? `Desde ${usd(settings.depositThresholdUsd)}: ${depositPercent}%${pricing.agreement?.depositPercent != null ? " (la habitual del cliente)" : ""} para empezar (${usd(depositRequired)}) y el resto al entregar.`
                  : `Menos de ${usd(settings.depositThresholdUsd)}: se paga completo para empezar.`}
              {pricing.eurRate && " Tasa euro: sus pagos en Bs van a la BCV euro (su acuerdo)."}
            </p>
            {canManage &&
              (depositInput === null ? (
                <Button type="button" variant="ghost" size="sm" className="w-fit px-0 text-muted-foreground" onClick={() => setDepositInput(String(depositPercent))}>
                  <PercentIcon aria-hidden />
                  Otra inicial para este pedido
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Label htmlFor="order-deposit" className="text-sm font-normal">
                    Inicial (%)
                  </Label>
                  <Input
                    id="order-deposit"
                    inputMode="decimal"
                    value={depositInput}
                    onChange={(e) => setDepositInput(e.target.value)}
                    className="h-11 w-24 text-right tabular-nums md:h-9"
                  />
                  <Button type="button" variant="ghost" size="icon" className="size-11 md:size-9" onClick={() => setDepositInput(null)}>
                    <XIcon aria-hidden />
                    <span className="sr-only">Volver a la inicial normal</span>
                  </Button>
                </div>
              ))}
            <PaymentRows rows={payments} methods={methods} onChange={setPayments} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={total <= 0}
              onClick={() => {
                const method = methodById.get(priceMethodId) ?? ratedMethods[0]
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
          <div className="rounded-lg border p-3">
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
                  <dt>{SHIPPING_FEE_LABELS[deliveryMethod]}</dt>
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
                <dt>Para empezar a producir ({depositPercent}%)</dt>
                <dd>{usd(depositRequired)}</dd>
              </div>
              {paidUsd > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Pagado ahora</dt>
                  <dd>{usd(paidUsd)}</dd>
                </div>
              )}
            </dl>
          </div>
        </FormStepPanel>
      )}

      {/* Barra de abajo: lo que falta, el total y avanzar o registrar. */}
      <FormStepperFooter
        steps={ORDER_STEPS}
        current={steps.step}
        onBack={steps.back}
        onNext={steps.next}
        nextDisabled={stepBlockers[steps.step].length > 0}
        submitLabel={pending ? "Registrando…" : `Registrar pedido · ${usd(total)}`}
        submitting={pending}
        submitDisabled={pending || blockers.length > 0}
        onSubmit={submit}
        total={usd(total)}
        alert={
          <>
            {error ? (
              <StatusAlert tone="error" title={error} />
            ) : (
              (lines.length > 0 || steps.step !== PRODUCTS_STEP) &&
              currentBlockers[0] && (
                <StatusAlert tone="warning" title={currentBlockers[0]}>
                  {steps.isLast && firstBlockedStep >= 0 && firstBlockedStep < DEPOSIT_STEP && (
                    <Button type="button" variant="link" className="h-auto p-0" onClick={() => steps.goTo(firstBlockedStep)}>
                      Ir a {ORDER_STEPS[firstBlockedStep].title}
                    </Button>
                  )}
                </StatusAlert>
              )
            )}
            {steps.isLast && paidUsd + 0.01 < depositRequired && lines.length > 0 && (
              <p className="text-xs text-muted-foreground">Sin el pago inicial, el pedido queda registrado pero no se empieza a producir.</p>
            )}
          </>
        }
      />

      <ComboPickerDialog
        combo={comboToPick}
        variants={pricing.visible}
        available={(id) => variantById.get(id)?.stock ?? 0}
        priceMethodId={priceMethodId}
        onCancel={() => setComboToPick(null)}
        onConfirm={(selection) => {
          const combo = comboToPick
          setComboToPick(null)
          if (!combo) return
          setLines((prev) => [
            ...prev,
            {
              key: `${combo.id}-${Date.now()}`,
              variantId: combo.id,
              quantity: selection.quantity,
              components: selection.components.map((c) => ({ ...c, customizations: [] })),
              customizations: [],
            },
          ])
        }}
      />
      <CustomizationDialog
        key={customizing ?? "none"}
        open={Boolean(customizingLine)}
        lineLabel={
          customizingPiece
            ? `${customizingPiece.quantity} × ${customizingPieceVariant?.productName} · ${customizingPieceVariant?.variantLabel} (${customizingLine?.variant.productName})`
            : customizingLine
              ? `${customizingLine.quantity} × ${customizingLine.variant.productName} · ${customizingLine.variant.variantLabel}`
              : ""
        }
        lineQuantity={customizingPiece?.quantity ?? customizingLine?.quantity ?? 1}
        types={customizationTypes}
        storageEnabled={storageEnabled}
        onClose={() => setCustomizing(null)}
        onSave={(c) => {
          addCustomization(c)
          setCustomizing(null)
        }}
      />
    </div>
  )
}

export default OrderForm

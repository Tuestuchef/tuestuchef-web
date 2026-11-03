"use client"

import {
  CheckIcon,
  ShoppingBagIcon,
  TruckIcon,
  UserRoundIcon,
  WalletIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import ChoiceChips from "@/common/components/choice-chips"
import DateField from "@/common/components/date-field"
import FormField from "@/common/components/form-field"
import { type FormStep, FormStepPanel, FormStepper, FormStepperFooter } from "@/common/components/form-stepper"
import { useFormSheetDirty } from "@/common/components/mobile-form-sheet"
import QuantityStepper from "@/common/components/quantity-stepper"
import StatusAlert from "@/common/components/status-alert"
import StatusBadge from "@/common/components/status-badge"
import { Button } from "@/common/components/ui/button"
import { Input } from "@/common/components/ui/input"
import { Label } from "@/common/components/ui/label"
import { Switch } from "@/common/components/ui/switch"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { useFormSteps } from "@/common/lib/hooks/use-form-steps.hook"
import { formatMoney, formatRate } from "@/common/lib/utils/format-money.util"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"
import CustomerPicker, { type PickedCustomer } from "@/modules/customers/components/customer-picker"
import CustomizationDialog, { type LineCustomization } from "@/modules/orders/components/customization-dialog"
import CustomizationList from "@/modules/orders/components/customization-list"
import { customizationPayload, customizingTarget, lineCustomizations, pieceTarget } from "@/modules/orders/lib/utils/customization.util"
import type { CustomizationOptions } from "@/modules/orders/lib/types/orders.types"

import { createSaleAction } from "../lib/actions/create-sale.action"
import { useCustomerPricing } from "../lib/hooks/use-customer-pricing.hook"
import { methodsForCustomer } from "../lib/utils/agreement-pricing.util"
import {
  CHANNEL_LABELS,
  chargesShipping,
  DELIVERY_LABELS,
  DELIVERY_METHODS,
  type DeliveryMethod,
  type DiscountType,
  LAST_CHANNEL_STORAGE_KEY,
  MANUAL_CHANNELS,
  SALES_MESSAGES,
  SHIPPING_FEE_LABELS,
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
  volumePercent,
} from "../lib/utils/sale-math.util"
import { isNetworkError, queueSale } from "../lib/utils/offline-queue.util"
import BackdateField from "./backdate-field"
import PaymentRows, { type PaymentRow } from "./payment-rows"
import { comboExtraUsd } from "../lib/utils/combo.util"
import ComboPickerDialog, { type ComboSelection } from "./combo-picker-dialog"
import ProductPicker from "./product-picker"

// Una pieza de un combo, con su personalización.
type ComboPiece = ComboSelection["components"][number] & { customizations: LineCustomization[] }

// Una línea del carrito. Un combo trae la talla, el color y la personalización de cada pieza (components).
type CartLine = {
  key: string
  variantId: string
  quantity: number
  source: SaleLineSource
  components?: ComboPiece[]
  // Nombre bordado, logo…: cobrada aparte o incluida (en un combo, va en cada pieza).
  customizations: LineCustomization[]
}
type PaymentMode = "full" | "custom" | "none"

type SaleFormProps = SaleFormData & CustomizationOptions & { canManage: boolean; storageEnabled: boolean }

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

// Los pasos: primero el cliente y la lista de precios (el acuerdo cambia precios y productos).
const SALE_STEPS: FormStep[] = [
  { title: "Cliente", icon: UserRoundIcon },
  { title: "Productos", icon: ShoppingBagIcon },
  { title: "Entrega", icon: TruckIcon },
  { title: "Cobro", icon: WalletIcon },
]
const [CUSTOMER_STEP, PRODUCTS_STEP, DELIVERY_STEP, PAYMENT_STEP] = [0, 1, 2, 3]

// Registrar una venta por pasos, pensada para el celular.
const SaleForm = ({
  variants,
  methods,
  rates,
  staffMaxDiscountPercent,
  staffMaxBackdateDays,
  volumeTiers: baseVolumeTiers,
  agreements,
  today,
  customizationTypes,
  customizationTiers,
  storageEnabled,
  canManage,
}: SaleFormProps) => {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [cart, setCart] = useState<CartLine[]>([])
  const [comboToPick, setComboToPick] = useState<SellableVariant | null>(null)
  const [customizing, setCustomizing] = useState<string | null>(null)
  const [priceMethodId, setPriceMethodId] = useState(methods[0]?.id ?? "")
  const [customer, setCustomer] = useState<PickedCustomer | null>(null)
  const [channel, setChannel] = useState<SaleChannel>("in_person")
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("pickup")
  const [deliveryFee, setDeliveryFee] = useState("")
  const [shipDate, setShipDate] = useState("")
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

  // Cliente con acuerdo: sus precios, sus exclusivos y sin descuento al mayor.
  const pricing = useCustomerPricing(variants, baseVolumeTiers, agreements, methods.map((m) => m.id), customer?.id ?? null)
  const volumeTiers = pricing.tiers
  const variantById = useMemo(() => new Map(pricing.priced.map((v) => [v.id, v])), [pricing.priced])
  const exclusiveLine = cart.find((l) => pricing.notAllowed(variantById.get(l.variantId)))
  // Cliente que paga sus Bs a tasa euro: sus métodos en Bs se calculan con la BCV euro (como la base).
  const ratedMethods = useMemo(() => methodsForCustomer(methods, pricing.agreement), [methods, pricing.agreement])
  const methodById = useMemo(() => new Map(ratedMethods.map((m) => [m.id, m])), [ratedMethods])
  const priceMethod = methodById.get(priceMethodId)

  // ---- Totales (mismas reglas que la base) ----
  const lines = cart.map((line) => {
    const variant = variantById.get(line.variantId)!
    const price = variant.pricesUsd[priceMethodId]
    // Un combo suma el recargo de sus piezas (talla o color) encima de su precio.
    const extra = line.components ? comboExtraUsd(line.components, (id) => variantById.get(id)?.extraUsd) : 0
    return { ...line, variant, price, total: price === undefined ? 0 : round(lineTotal(price, line.quantity) + extra) }
  })
  const missingPrice = lines.filter((l) => l.price === undefined)
  // Lo que se está personalizando: una línea suelta o una pieza de un combo.
  const target = customizingTarget(customizing)
  const customizingLine = lines.find((l) => l.key === target?.lineKey)
  const customizingPiece = target?.pieceIndex != null ? customizingLine?.components?.[target.pieceIndex] : undefined
  const customizingPieceVariant = customizingPiece ? variantById.get(customizingPiece.variantId) : undefined
  const addCustomization = (c: LineCustomization) =>
    setCart((prev) =>
      prev.map((l) => {
        if (l.key !== target?.lineKey) return l
        if (target.pieceIndex === null) return { ...l, customizations: [...l.customizations, c] }
        return { ...l, components: l.components?.map((p, i) => (i === target.pieceIndex ? { ...p, customizations: [...p.customizations, c] } : p)) }
      })
    )
  const removeCustomization = (lineKey: string, pieceIndex: number | null, key: string) =>
    setCart((prev) =>
      prev.map((l) => {
        if (l.key !== lineKey) return l
        if (pieceIndex === null) return { ...l, customizations: l.customizations.filter((x) => x.key !== key) }
        return { ...l, components: l.components?.map((p, i) => (i === pieceIndex ? { ...p, customizations: p.customizations.filter((x) => x.key !== key) } : p)) }
      })
    )

  // Stock pedido por variante: líneas sueltas y piezas de combos.
  const stockWanted = new Map<string, number>()
  for (const line of cart) {
    const pieces = line.components ?? [{ variantId: line.variantId, quantity: line.quantity, source: line.source }]
    for (const piece of pieces) {
      if (piece.source === "stock") stockWanted.set(piece.variantId, (stockWanted.get(piece.variantId) ?? 0) + piece.quantity)
    }
  }
  const shortStock = [...stockWanted].flatMap(([variantId, wanted]) => {
    const variant = variantById.get(variantId)
    return variant && wanted > variant.stock ? [variant] : []
  })
  const availableFor = (variantId: string) => (variantById.get(variantId)?.stock ?? 0) - (stockWanted.get(variantId) ?? 0)

  const subtotal = round(lines.reduce((sum, l) => sum + l.total, 0))
  // Descuento al mayor: por piezas (un combo cuenta por sus componentes).
  const pieces = cart.reduce(
    (sum, l) => sum + (l.components ? l.components.reduce((s, c) => s + c.quantity, 0) : l.quantity),
    0
  )
  const volumePct = volumePercent(volumeTiers, pieces)
  const volume = round((subtotal * volumePct) / 100)
  const nextTier = volumeTiers.find((t) => t.minQuantity > pieces)
  // Personalización cobrada: por tipo, con su descuento al mayor (como la base). No entra en el
  // descuento al mayor de productos, pero sí en el descuento manual.
  const typeById = new Map(customizationTypes.map((t) => [t.id, t]))
  const chargedPerType = new Map<string, number>()
  for (const line of cart)
    for (const c of lineCustomizations(line)) if (c.charged) chargedPerType.set(c.typeId, (chargedPerType.get(c.typeId) ?? 0) + c.quantity)
  const customizationTotal = round(
    [...chargedPerType].reduce(
      (sum, [typeId, qty]) =>
        sum + round(qty * (typeById.get(typeId)?.unitPriceUsd ?? 0) * (1 - volumePercent(customizationTiers, qty) / 100)),
      0
    )
  )
  const customizationOverLine = cart.find((l) => l.customizations.some((c) => c.quantity > l.quantity))
  const discountBase = round(subtotal + customizationTotal - volume)
  const parsedDiscount = showDiscount ? (parseAmount(discountValue) ?? 0) : 0
  const discount = Math.min(discountUsd(discountBase, discountType, parsedDiscount), discountBase)
  const fee = chargesShipping(deliveryMethod) ? (parseAmount(deliveryFee) ?? 0) : 0
  const total = round(discountBase - discount + fee)
  const overDiscountLimit = !canManage && discountPercent(discountBase, discount) > staffMaxDiscountPercent + 0.0001

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

  // Lo que impide seguir, por paso (en el último se revisan todos antes de registrar).
  const stepBlockers = [
    [customer?.blockedReason && `Cliente bloqueado: no se le puede vender (${customer.blockedReason}).`],
    [
      cart.length === 0 && SALES_MESSAGES.EMPTY_CART,
      exclusiveLine && `"${variantById.get(exclusiveLine.variantId)?.productName}" es exclusivo de otro cliente: quítalo o elige su cliente.`,
      missingPrice[0] && SALES_MESSAGES.NO_PRICE(missingPrice[0].variant.productName, priceMethod?.name ?? ""),
      customizationOverLine &&
        `La personalización de "${variantById.get(customizationOverLine.variantId)?.productName}" tiene más piezas que la línea.`,
      shortStock[0] && `No hay suficiente "${shortStock[0].productName}" (${shortStock[0].sku}) en inventario.`,
    ],
    [backdateWithoutRate && "No hay tasas registradas para esa fecha. Owner o admin debe cargarlas."],
    [
      overDiscountLimit && `El descuento máximo sin owner o admin es ${staffMaxDiscountPercent}%.`,
      showDiscount && discount > 0 && !discountReason.trim() && "Indica el motivo del descuento.",
      overpaid && "Los pagos superan el total.",
      bsWithoutRate && "Falta la tasa BCV de hoy para cobrar en Bs.",
    ],
  ].map((list) => list.filter(Boolean) as string[])
  const blockers = stepBlockers.flat()
  const steps = useFormSteps(SALE_STEPS.length)
  useFormSheetDirty(cart.length > 0 || customer !== null)
  // Primer paso con algo pendiente (para llevar ahí desde el resumen).
  const firstBlockedStep = stepBlockers.findIndex((list) => list.length > 0)

  // ---- Carrito ----
  // Una variante elegida (género, color y talla) con su cantidad; si ya está, suma.
  const addVariant = (variant: SellableVariant, quantity: number) =>
    setCart((prev) => {
      const existing = prev.find((l) => l.key === variant.id)
      if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + quantity } : l))
      const source: SaleLineSource =
        variant.fulfillmentType === "made_to_order" || (variant.fulfillmentType === "both" && variant.stock < quantity)
          ? "made_to_order"
          : "stock"
      return [...prev, { key: variant.id, variantId: variant.id, quantity, source, customizations: [] }]
    })
  const addCombo = (selection: ComboSelection) => {
    if (!comboToPick) return
    const combo = comboToPick
    setComboToPick(null)
    setCart((prev) => [
      ...prev,
      {
        key: `${combo.id}-${Date.now()}`,
        variantId: combo.id,
        quantity: selection.quantity,
        source: "combo",
        components: selection.components.map((c) => ({ ...c, customizations: [] })),
        customizations: [],
      },
    ])
  }
  const setQuantity = (key: string, quantity: number) =>
    setCart((prev) => (quantity <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, quantity } : l))))
  const toggleSource = (key: string) =>
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, source: l.source === "stock" ? "made_to_order" : "stock" } : l)))

  const addPaymentRow = () => {
    const method = priceMethod ?? ratedMethods[0]
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

  // Sin conexión: la venta se guarda en el teléfono y se envía sola al volver la señal.
  // Identificador de esta venta, igual en el envío en línea y en la cola sin conexión: si la venta
  // llegó al servidor pero la respuesta se perdió, al reenviarla no se duplica. Uno nuevo por venta.
  const clientRef = useRef<string | null>(null)

  const saveOffline = async (sale: Record<string, unknown>, ref: string) => {
    const occurredAt = isBackdated ? new Date(`${date}T12:00:00-04:00`).toISOString() : new Date().toISOString()
    await queueSale({
      clientRef: ref,
      payload: { sale, occurredAt },
      label: lines.map((l) => `${l.quantity} × ${l.variant.productName}`).join(", "),
      totalUsd: total,
      queuedAt: new Date().toISOString(),
    })
    toast.success("Sin conexión: la venta quedó guardada en este teléfono y se enviará sola.")
    clientRef.current = null
    setCart([])
    setPaymentRows([])
    setPaymentMode("full")
    setShowDiscount(false)
    setDiscountValue("")
    setDiscountReason("")
    setCustomer(null)
    setNotes("")
    setDeliveryFee("")
    setShipDate("")
    steps.reset()
  }

  const submit = () => {
    setError(null)
    clientRef.current ??= crypto.randomUUID()
    const ref = clientRef.current
    startTransition(async () => {
      const sale = {
        client_ref: ref,
        channel,
        price_method_id: priceMethodId,
        delivery_method: deliveryMethod,
        customer_id: customer?.id ?? null,
        items: cart.map((l) =>
          l.components
            ? {
                variant_id: l.variantId,
                quantity: l.quantity,
                components: l.components.map((c) => ({
                  variant_id: c.variantId,
                  quantity: c.quantity,
                  source: c.source,
                  customizations: c.customizations.map(customizationPayload),
                })),
              }
            : {
                variant_id: l.variantId,
                quantity: l.quantity,
                source: l.source,
                customizations: l.customizations.map(customizationPayload),
              }
        ),
        payments: payments.map((p) => ({ payment_method_id: p.methodId, amount: p.amount })),
        delivery_fee_usd: fee,
        discount_type: showDiscount && discount > 0 ? discountType : null,
        discount_value: showDiscount && discount > 0 ? parsedDiscount : null,
        discount_reason: showDiscount && discount > 0 ? discountReason : null,
        notes: notes.trim() || null,
        delivered,
        ship_date: chargesShipping(deliveryMethod) && shipDate ? shipDate : null,
        date: isBackdated ? date : undefined,
      }
      if (!navigator.onLine) {
        await saveOffline(sale, ref)
        return
      }
      let result: Awaited<ReturnType<typeof createSaleAction>>
      try {
        result = await createSaleAction(sale)
      } catch (cause) {
        if (isNetworkError(cause)) await saveOffline(sale, ref)
        else setError("No se pudo registrar la venta.")
        return
      }
      if (!result.ok) {
        setError(result.error)
        return
      }
      clientRef.current = null
      toast.success(SALES_MESSAGES.CREATED)
      router.push(ROUTES.SALE(result.saleId))
    })
  }

  if (methods.length === 0) {
    return <StatusAlert tone="warning" title="No hay métodos de pago activos. Owner o admin debe crearlos primero." />
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
      <FormStepper steps={SALE_STEPS} current={steps.step} reached={steps.reached} onSelect={steps.goTo} />

      {/* 1. Cliente y lista de precios: el acuerdo del cliente cambia precios y productos. */}
      {steps.step === CUSTOMER_STEP && (
        <FormStepPanel step={steps.step} direction={steps.direction}>
          <div className="grid gap-2">
            <Label>
              Cliente <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <CustomerPicker value={customer} onChange={setCustomer} canManage={canManage} emptyLabel="Sin cliente (venta rápida)" />
          </div>

          {pricing.agreement && (
            <p className="rounded-lg border p-3 text-sm">
              Tiene acuerdo: sus precios especiales y sus productos exclusivos se aplican solos, sin descuento al mayor.
              {pricing.eurRate && " Paga sus Bs a tasa euro."}
            </p>
          )}
          <FormField label="Método de pago" htmlFor="sale-method" hint="Define el precio de cada producto.">
            <ChoiceChips
              id="sale-method"
              label="Método de pago"
              value={priceMethodId}
              onChange={setPriceMethodId}
              options={methods.map((m) => ({ value: m.id, label: m.name }))}
            />
          </FormField>

        </FormStepPanel>
      )}

      {/* 2. Productos */}
      {steps.step === PRODUCTS_STEP && (
        <FormStepPanel step={steps.step} direction={steps.direction} className="gap-2">
          <section className="grid gap-2">
            <Label>Productos</Label>
            <ProductPicker
              variants={pricing.visible}
              priceMethodId={priceMethodId}
              available={availableFor}
              placeholder="Filipina 3/4 dama negra…"
              onAdd={addVariant}
              onCombo={setComboToPick}
            />

            {lines.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {lines.map((line) => (
                  <li key={line.key} className="grid gap-2 p-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200">
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
                              {line.variant.agreementPrice && " · precio acuerdo"}
                              {line.source === "stock" && ` · hay ${quantityFormat.format(line.variant.stock)}`}
                            </>
                          )}
                        </span>
                        {line.components && (
                          <ul className="mt-1 grid gap-0.5 border-l-2 pl-2 text-xs text-muted-foreground">
                            {line.components.map((c, index) => {
                              const piece = variantById.get(c.variantId)
                              return (
                                <li key={`${c.variantId}-${index}`} className="grid gap-1">
                                  <span className="flex flex-wrap items-center gap-x-2">
                                    <span>
                                      {quantityFormat.format(c.quantity)} × {piece?.productName} · {piece?.variantLabel}
                                      {c.source === "made_to_order" && " · por encargo"}
                                      {piece && piece.extraUsd > 0 && ` · +${usd(round(piece.extraUsd * c.quantity))}`}
                                    </span>
                                    {customizationTypes.length > 0 && (
                                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setCustomizing(pieceTarget(line.key, index))}>
                                        <PlusIcon aria-hidden />
                                        Personalizar
                                      </Button>
                                    )}
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
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone="info">{quantityFormat.format(line.quantity)} {line.quantity === 1 ? "combo" : "combos"}</StatusBadge>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setQuantity(line.key, 0)}>
                          <Trash2Icon aria-hidden />
                          Quitar
                        </Button>
                      </div>
                    ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <QuantityStepper removable value={line.quantity} onChange={(q) => setQuantity(line.key, q)} label={line.variant.productName} />
                      {line.variant.fulfillmentType === "both" ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => toggleSource(line.key)}>
                          {SOURCE_LABELS[line.source]}
                          <span className="sr-only">(cambiar)</span>
                        </Button>
                      ) : (
                        line.source === "made_to_order" && <StatusBadge tone="info">Por encargo</StatusBadge>
                      )}
                      {line.source === "stock" && line.quantity > line.variant.stock && (
                        <StatusBadge tone="error">Stock insuficiente</StatusBadge>
                      )}
                      {customizationTypes.length > 0 && (
                        <Button type="button" variant="outline" size="sm" onClick={() => setCustomizing(line.key)}>
                          <PlusIcon aria-hidden />
                          Personalizar
                        </Button>
                      )}
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
              {quantityFormat.format(pieces)} {pieces === 1 ? "pieza" : "piezas"} · {usd(subtotal)}
              {volume > 0 && ` · al mayor ${volumePct}%`}
              {nextTier && ` · con ${quantityFormat.format(nextTier.minQuantity - pieces)} más: ${nextTier.percent}% al mayor`}
            </p>
          )}
        </FormStepPanel>
      )}

      {/* 3. Entrega: canal, entrega, fecha y notas */}
      {steps.step === DELIVERY_STEP && (
        <FormStepPanel step={steps.step} direction={steps.direction}>
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
                options={DELIVERY_METHODS.map((d) => ({ value: d, label: DELIVERY_LABELS[d] }))}
              />
            </FormField>
          </div>
          {chargesShipping(deliveryMethod) && (
            <FormField label={`Cobro de ${SHIPPING_FEE_LABELS[deliveryMethod].toLowerCase()} (USD)`} htmlFor="sale-fee" optional hint="Se suma al total de la venta.">
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
          {chargesShipping(deliveryMethod) && (
            <FormField label="Fecha de envío" htmlFor="sale-ship-date" optional hint="Si se envía otro día. La guía se anota luego, desde la venta.">
              <DateField id="sale-ship-date" value={shipDate} onChange={setShipDate} min={today} clearable placeholder="Sin fecha" />
            </FormField>
          )}
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
              <span className="block text-xs text-muted-foreground">Todas las líneas quedan como entregadas, también las de encargo.</span>
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
        </FormStepPanel>
      )}

      {/* 4. Cobro: resumen, descuento y pago */}
      {steps.step === PAYMENT_STEP && (
        <FormStepPanel step={steps.step} direction={steps.direction}>
          <div className="divide-y rounded-lg border px-3">
            {reviewRow("Cliente y precios", `${customer?.name ?? "Venta rápida (sin cliente)"} · ${priceMethod?.name ?? ""}`, CUSTOMER_STEP)}
            {reviewRow(
              "Productos",
              lines.map((l) => `${quantityFormat.format(l.quantity)} × ${l.variant.productName}`).join(", ") || "—",
              PRODUCTS_STEP
            )}
            {reviewRow(
              "Entrega",
              [
                CHANNEL_LABELS[channel],
                DELIVERY_LABELS[deliveryMethod],
                delivered ? "ya entregada" : "por entregar",
                isBackdated && `fecha ${date.split("-").reverse().join("/")}`,
              ]
                .filter(Boolean)
                .join(" · "),
              DELIVERY_STEP
            )}
          </div>
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

          <FormField label="Pago" htmlFor="sale-payment" hint={pricing.eurRate ? "Tasa euro: sus pagos en Bs van a la BCV euro (su acuerdo)." : undefined}>
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
              <PaymentRows rows={paymentRows} methods={methods} onChange={setPaymentRows} />
              {paymentRows.length < 5 && (
                <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addPaymentRow}>
                  <PlusIcon aria-hidden />
                  Otro pago{balance > 0 ? ` (resta ${usd(balance)})` : ""}
                </Button>
              )}
            </div>
          )}

          <div className="rounded-lg border p-3">
            <dl className="grid gap-1 text-sm tabular-nums">
              {(volume > 0 || discount > 0 || fee > 0 || customizationTotal > 0) && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Subtotal</dt>
                  <dd>{usd(subtotal)}</dd>
                </div>
              )}
              {customizationTotal > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Personalización</dt>
                  <dd>{usd(customizationTotal)}</dd>
                </div>
              )}
              {volume > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>
                    Al mayor {volumePct}% ({quantityFormat.format(pieces)} piezas)
                  </dt>
                  <dd>−{usd(volume)}</dd>
                </div>
              )}
              {nextTier && pieces > 0 && (
                <p className="text-xs text-muted-foreground">
                  Con {quantityFormat.format(nextTier.minQuantity - pieces)} piezas más: {nextTier.percent}% al mayor.
                </p>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Descuento</dt>
                  <dd>−{usd(discount)}</dd>
                </div>
              )}
              {fee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>{SHIPPING_FEE_LABELS[deliveryMethod]}</dt>
                  <dd>{usd(fee)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd>{usd(total)}</dd>
              </div>
              {priceMethod && priceMethod.rateKind !== "none" && total > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>
                    En Bs (tasa {priceMethod.rateKind === "bcv_eur" ? "euro " : ""}
                    {formatRate(priceMethod.rateKind === "bcv_eur" ? saleRates.bcvEur : saleRates.bcvUsd)})
                  </dt>
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
          </div>
        </FormStepPanel>
      )}

      <CustomizationDialog
        key={customizing ?? "none"}
        mode="sale"
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

      <ComboPickerDialog combo={comboToPick} variants={pricing.visible} available={availableFor} priceMethodId={priceMethodId} onCancel={() => setComboToPick(null)} onConfirm={addCombo} />

      {/* Barra de abajo: lo que falta, el total y avanzar o registrar. */}
      <FormStepperFooter
        steps={SALE_STEPS}
        current={steps.step}
        onBack={steps.back}
        onNext={steps.next}
        nextDisabled={stepBlockers[steps.step].length > 0}
        submitLabel={pending ? "Registrando…" : `Registrar venta${isBackdated ? " retroactiva" : ""} · ${usd(total)}`}
        submitting={pending}
        submitDisabled={pending || blockers.length > 0}
        onSubmit={submit}
        total={usd(total)}
        alert={
          error ? (
            <StatusAlert tone="error" title={error} />
          ) : (
            (cart.length > 0 || steps.step !== PRODUCTS_STEP) &&
            currentBlockers[0] && (
              <StatusAlert tone="warning" title={currentBlockers[0]}>
                {steps.isLast && firstBlockedStep >= 0 && firstBlockedStep < PAYMENT_STEP && (
                  <Button type="button" variant="link" className="h-auto p-0" onClick={() => steps.goTo(firstBlockedStep)}>
                    Ir a {SALE_STEPS[firstBlockedStep].title}
                  </Button>
                )}
              </StatusAlert>
            )
          )
        }
      />
    </div>
  )
}

export default SaleForm

"use client"

import { ClipboardCheckIcon, PaletteIcon, ShoppingBagIcon, SlidersHorizontalIcon, Trash2Icon, UserRoundIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useMemo, useState, useTransition } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/common/components/ui/select"
import { Switch } from "@/common/components/ui/switch"
import { Textarea } from "@/common/components/ui/textarea"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { useFormSteps } from "@/common/lib/hooks/use-form-steps.hook"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"
import CustomerPicker, { type PickedCustomer } from "@/modules/customers/components/customer-picker"
import { CUSTOMER_KIND_LABELS } from "@/modules/customers/lib/constants/customers.constants"
import { formatPhone, formatTaxId } from "@/modules/customers/lib/utils/normalize-contact.util"
import CustomizationDialog, { type LineCustomization } from "@/modules/orders/components/customization-dialog"
import CustomizationList from "@/modules/orders/components/customization-list"
import { customizingTarget, lineCustomizations, pieceTarget } from "@/modules/orders/lib/utils/customization.util"
import ComboPickerDialog, { type ComboSelection } from "@/modules/sales/components/combo-picker-dialog"
import ProductPicker from "@/modules/sales/components/product-picker"
import { useCustomerPricing } from "@/modules/sales/lib/hooks/use-customer-pricing.hook"
import type { SellableVariant } from "@/modules/sales/lib/types/sales.types"

import { saveQuoteDraftAction } from "../lib/actions/quotes.action"
import { QUOTE_CURRENCIES_LABELS } from "../lib/constants/quotes.constants"
import type { CustomerKind, DiscountType, QuoteCurrencies, QuoteDetail, QuoteFormData, QuoteItemCustomization } from "../lib/types/quotes.types"
import { customizationTotal, quoteTotals } from "../lib/utils/quote-math.util"
import QuoteHeaderField from "./quote-header-field"
import QuoteImagesField, { type QuoteImageDraft } from "./quote-images-field"

type QuoteLine = {
  key: string
  variantId: string
  quantity: number
  discountPercent: string
  // En un combo, la personalización va en cada pieza.
  components?: (ComboSelection["components"][number] & { customizations: LineCustomization[] })[]
  customizations: LineCustomization[]
}

// La personalización guardada de una línea o pieza, para editarla.
const fromSaved = (c: QuoteItemCustomization): LineCustomization => ({
  key: c.id,
  typeId: c.typeId,
  quantity: c.quantity,
  text: c.text ?? undefined,
  position: c.position ?? undefined,
  sizeCm: c.sizeCm ?? undefined,
  note: c.note ?? undefined,
  charged: c.charged,
})

// Lo que se envía a la base (en el presupuesto no van nombres ni logo: se piden en el pedido).
const toPayload = (c: LineCustomization) => ({
  type_id: c.typeId,
  quantity: c.quantity,
  size_cm: c.sizeCm ?? null,
  position: c.position ?? null,
  text: c.text ?? null,
  note: c.note ?? null,
  charged: c.charged,
})

type CustomerDraft = {
  kind: CustomerKind
  name: string
  legalName: string
  taxId: string
  phone: string
  email: string
  address: string
  contactPerson: string
}

type DiscountMode = "none" | DiscountType

const usd = (value: number) => formatMoney(value, "USD")
const bs = (value: number) => formatMoney(value, "VES")
const NONE = "none"
const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const CURRENCY_OPTIONS = (Object.keys(QUOTE_CURRENCIES_LABELS) as QuoteCurrencies[]).map((value) => ({ value, label: QUOTE_CURRENCIES_LABELS[value] }))
const KIND_OPTIONS = (["company", "person"] as const).map((value) => ({ value, label: CUSTOMER_KIND_LABELS[value] }))
const DISCOUNT_OPTIONS = [
  { value: "none", label: "Sin descuento" },
  { value: "percent", label: "Porcentaje" },
  { value: "amount", label: "Monto (USD)" },
] as const

// Estado inicial desde un borrador guardado (al editar).
function linesFromQuote(quote: QuoteDetail): QuoteLine[] {
  return quote.items
    .filter((i) => !i.parentId)
    .map((item) => ({
      key: item.id,
      variantId: item.variantId,
      quantity: item.quantity,
      discountPercent: item.discountPercent ? String(item.discountPercent) : "",
      ...(item.kind === "combo" && {
        components: quote.items
          .filter((c) => c.parentId === item.id)
          .map((c) => ({ variantId: c.variantId, quantity: c.quantity, source: "made_to_order" as const, customizations: c.customizations.map(fromSaved) })),
      }),
      customizations: item.customizations.map(fromSaved),
    }))
}

const SwitchRow = ({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) => {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="grid gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

type QuoteFormProps = QuoteFormData & {
  canManage: boolean
  quote?: QuoteDetail
  storageEnabled: boolean
  // Imagen del encabezado vigente: la propia del presupuesto o la de la empresa.
  companyHeaderUrl: string | null
  quoteHeaderUrl: string | null
}

// Los pasos del presupuesto.
const QUOTE_STEPS: FormStep[] = [
  { title: "Cliente", icon: UserRoundIcon },
  { title: "Productos", icon: ShoppingBagIcon },
  { title: "Condiciones", icon: SlidersHorizontalIcon },
  { title: "Revisar", icon: ClipboardCheckIcon },
]
const [CUSTOMER_STEP, PRODUCTS_STEP, CONDITIONS_STEP, REVIEW_STEP] = [0, 1, 2, 3]

// Crear o editar un presupuesto (borrador), por pasos. La base vuelve a calcular precios y totales al guardar.
const QuoteForm = ({
  variants,
  rates,
  staffMaxDiscountPercent,
  volumeTiers: baseVolumeTiers,
  agreements,
  today,
  customizationTypes,
  customizationTiers,
  priceLists,
  settings,
  catalogImages,
  canManage,
  quote,
  storageEnabled,
  companyHeaderUrl,
  quoteHeaderUrl,
}: QuoteFormProps) => {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [customer, setCustomer] = useState<PickedCustomer | null>(
    quote?.customerId ? { id: quote.customerId, name: quote.customer.name } : null
  )
  const [draft, setDraft] = useState<CustomerDraft>({
    kind: quote && !quote.customerId ? quote.customer.kind : "company",
    name: quote && !quote.customerId ? quote.customer.name : "",
    legalName: (!quote?.customerId && quote?.customer.legalName) || "",
    taxId: !quote?.customerId && quote?.customer.taxId ? formatTaxId(quote.customer.taxId) : "",
    phone: !quote?.customerId && quote?.customer.phone ? formatPhone(quote.customer.phone) : "",
    email: (!quote?.customerId && quote?.customer.email) || "",
    address: (!quote?.customerId && quote?.customer.address) || "",
    contactPerson: (!quote?.customerId && quote?.customer.contactPerson) || "",
  })
  const [lines, setLines] = useState<QuoteLine[]>(quote ? linesFromQuote(quote) : [])
  const [comboToPick, setComboToPick] = useState<SellableVariant | null>(null)
  const [customizing, setCustomizing] = useState<string | null>(null)
  const [currencies, setCurrencies] = useState<QuoteCurrencies>(quote?.currencies ?? settings.defaultCurrencies)
  const [usdListId, setUsdListId] = useState(quote?.usdPriceList?.id ?? settings.defaultUsdPriceMethodId ?? NONE)
  const [vesListId, setVesListId] = useState(quote?.vesPriceList?.id ?? settings.defaultVesPriceMethodId ?? NONE)
  const [validUntil, setValidUntil] = useState(
    quote && quote.validUntil >= today ? quote.validUntil : addDays(today, settings.validityDays)
  )
  const [discountMode, setDiscountMode] = useState<DiscountMode>(quote?.discount?.type ?? "none")
  const [discountValue, setDiscountValue] = useState(quote?.discount ? String(quote.discount.value) : "")
  const [discountReason, setDiscountReason] = useState(quote?.discountReason ?? "")
  const [vatEnabled, setVatEnabled] = useState(quote?.vatEnabled ?? settings.vatDefaultEnabled)
  const [igtfEnabled, setIgtfEnabled] = useState(quote?.igtfNoteEnabled ?? settings.igtfNoteDefault)
  const [groupBySize, setGroupBySize] = useState(quote?.groupBySize ?? false)
  const [terms, setTerms] = useState(quote ? (quote.terms ?? "") : settings.defaultTerms)
  const [header, setHeader] = useState<{ path: string; url: string | null } | null>(
    quote?.headerImagePath ? { path: quote.headerImagePath, url: quoteHeaderUrl } : null
  )
  const [images, setImages] = useState<QuoteImageDraft[]>(() =>
    (quote?.images ?? []).map((i) => ({
      key: i.id,
      source: i.source,
      productImageId: i.productImageId,
      path: i.source === "upload" ? i.path : null,
      url: i.url,
      label: i.label ?? "",
    }))
  )

  // Cliente con acuerdo: sus precios, sus exclusivos y sin descuento al mayor.
  const pricing = useCustomerPricing(variants, baseVolumeTiers, agreements, priceLists.map((l) => l.id), customer?.id ?? null)
  const volumeTiers = pricing.tiers
  const variantById = useMemo(() => new Map(pricing.priced.map((v) => [v.id, v])), [pricing.priced])
  const exclusiveLine = lines.find((l) => pricing.notAllowed(variantById.get(l.variantId)))
  const typeById = useMemo(() => new Map(customizationTypes.map((t) => [t.id, t])), [customizationTypes])
  const usdLists = priceLists.filter((l) => l.currency === "USD")
  const vesLists = priceLists.filter((l) => l.currency === "VES")
  const useUsd = currencies !== "ves"
  const useVes = currencies !== "usd"
  const usdList = usdLists.find((l) => l.id === usdListId)
  const vesList = vesLists.find((l) => l.id === vesListId)

  // ---- Totales (vista previa; la base decide) ----
  const allCustomizations = lines.flatMap(lineCustomizations)
  const custom = customizationTotal(allCustomizations, (id) => typeById.get(id)?.unitPriceUsd ?? 0, customizationTiers)
  // Un combo lleva además una línea por cada pieza con recargo (talla o color), con su mismo descuento.
  const mathLines = (listId: string | undefined) =>
    lines.flatMap((line) => {
      const discountPercent = parseAmount(line.discountPercent) ?? 0
      const extras = (line.components ?? []).flatMap((c) => {
        const extra = variantById.get(c.variantId)?.extraUsd ?? 0
        return extra > 0 ? [{ quantity: c.quantity, discountPercent, price: listId ? extra : undefined, pieces: 0 }] : []
      })
      return [
        {
          quantity: line.quantity,
          discountPercent,
          price: listId ? variantById.get(line.variantId)?.pricesUsd[listId] : undefined,
          pieces: line.components ? line.components.reduce((s, c) => s + c.quantity, 0) : line.quantity,
        },
        ...extras,
      ]
    })
  const discountType = discountMode === "none" ? null : discountMode
  const discountAmount = discountType ? (parseAmount(discountValue) ?? null) : null
  const totalsFor = (listId: string | undefined) =>
    quoteTotals({
      lines: mathLines(listId),
      customization: custom,
      volumeTiers,
      discountType,
      discountValue: discountAmount,
      vatPercent: vatEnabled ? settings.vatPercent : null,
    })
  const usdTotals = useUsd ? totalsFor(usdList?.id) : null
  const vesTotals = useVes ? totalsFor(vesList?.id) : null
  // Tasa de los Bs: la de la lista, o la BCV euro si el cliente paga a tasa euro (como la base).
  const bcv = (pricing.eurRate || vesList?.eurRate ? rates?.bcvEur : rates?.bcvUsd) ?? 0

  const hasLineDiscount = lines.some((l) => (parseAmount(l.discountPercent) ?? 0) > 0)
  const needsReason = (discountType !== null && (discountAmount ?? 0) > 0) || hasLineDiscount
  const staffLimit = !canManage ? staffMaxDiscountPercent : null
  const belowMinimum = (() => {
    const perType = new Map<string, number>()
    for (const c of allCustomizations) perType.set(c.typeId, (perType.get(c.typeId) ?? 0) + c.quantity)
    for (const [typeId, qty] of perType) {
      const type = typeById.get(typeId)
      if (type && qty < type.minQuantity) return `"${type.name}" es desde ${type.minQuantity} piezas (van ${qty}).`
    }
    return null
  })()
  const missingPrice = (() => {
    for (const [list, label] of [
      [useUsd ? usdList : undefined, "USD"],
      [useVes ? vesList : undefined, "Bs"],
    ] as const) {
      if (!list) continue
      const line = lines.find((l) => variantById.get(l.variantId)?.pricesUsd[list.id] === undefined)
      if (line) return `"${variantById.get(line.variantId)?.productName}" no tiene precio en la lista ${label} (${list.name}).`
    }
    return null
  })()

  // Lo que impide seguir, por paso (en el último se revisan todos antes de guardar).
  const stepBlockers = [
    [
      !customer && !draft.name.trim() && "Elige un cliente o escribe su nombre.",
      customer?.blockedReason && `Cliente bloqueado: no puede recibir presupuestos (${customer.blockedReason}).`,
      useUsd && !usdList && "Elige la lista de precios en USD.",
      useVes && !vesList && "Elige la lista de precios en Bs.",
    ],
    [
      lines.length === 0 && "Agrega al menos un producto.",
      exclusiveLine && `"${variantById.get(exclusiveLine.variantId)?.productName}" es exclusivo de otro cliente: quítalo o elige su cliente.`,
      missingPrice,
      belowMinimum,
      staffLimit !== null && lines.some((l) => (parseAmount(l.discountPercent) ?? 0) > staffLimit) && `El descuento máximo sin owner o admin es ${staffLimit}%.`,
    ],
    [
      validUntil < today && "La fecha de vencimiento no puede ser pasada.",
      needsReason && !discountReason.trim() && "Indica el motivo del descuento.",
    ],
    [],
  ].map((list) => list.filter(Boolean) as string[])
  const blockers = stepBlockers.flat()
  // Al editar un presupuesto, todo ya está cargado: se puede saltar a cualquier paso.
  const steps = useFormSteps(QUOTE_STEPS.length, { allReached: Boolean(quote) })
  // Primer paso con algo pendiente (para llevar ahí desde el último).
  const firstBlockedStep = stepBlockers.findIndex((list) => list.length > 0)

  // Una variante elegida (género, color y talla) con su cantidad; si ya está, suma.
  const addVariant = (variant: SellableVariant, quantity: number) =>
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id && !l.components)
      if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + quantity } : l))
      return [...prev, { key: crypto.randomUUID(), variantId: variant.id, quantity, discountPercent: "", customizations: [] }]
    })
  const updateLine = (key: string, patch: Partial<QuoteLine>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const setQuantity = (key: string, quantity: number) =>
    setLines((prev) => (quantity <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, quantity } : l))))
  // Lo que se está personalizando: una línea suelta o una pieza de un combo.
  const target = customizingTarget(customizing)
  const customizingLine = lines.find((l) => l.key === target?.lineKey)
  const customizingVariant = customizingLine ? variantById.get(customizingLine.variantId) : undefined
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
      const result = await saveQuoteDraftAction({
        id: quote?.id ?? null,
        customer_id: customer?.id ?? null,
        customer: customer
          ? undefined
          : {
              kind: draft.kind,
              name: draft.name,
              legal_name: draft.legalName,
              tax_id: draft.taxId,
              phone: draft.phone,
              email: draft.email,
              address: draft.address,
              contact_person: draft.contactPerson,
            },
        valid_until: validUntil,
        currencies,
        usd_price_method_id: useUsd ? (usdList?.id ?? null) : null,
        ves_price_method_id: useVes ? (vesList?.id ?? null) : null,
        vat_enabled: vatEnabled,
        igtf_note_enabled: igtfEnabled,
        group_by_size: groupBySize,
        discount_type: discountType,
        discount_value: discountAmount,
        discount_reason: discountReason,
        terms,
        header_image_path: header?.path ?? null,
        images: images.map((i) =>
          i.source === "product" ? { source: "product", product_image_id: i.productImageId, label: i.label } : { source: "upload", path: i.path, label: i.label }
        ),
        items: lines.map((l) => ({
          variant_id: l.variantId,
          quantity: l.quantity,
          discount_percent: parseAmount(l.discountPercent) ?? 0,
          ...(l.components && {
            components: l.components.map((c) => ({ variant_id: c.variantId, quantity: c.quantity, customizations: c.customizations.map(toPayload) })),
          }),
          customizations: l.customizations.map(toPayload),
        })),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(result.message)
      router.push(ROUTES.QUOTE(result.id))
    })
  }

  const listSelect = (id: string, value: string, onChange: (v: string) => void, lists: typeof priceLists) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-11 w-full md:h-9">
        <SelectValue placeholder="Elige la lista" />
      </SelectTrigger>
      <SelectContent>
        {lists.map((list) => (
          <SelectItem key={list.id} value={list.id}>
            {list.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

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
      <FormStepper steps={QUOTE_STEPS} current={steps.step} reached={steps.reached} onSelect={steps.goTo} />

      {/* 1. Cliente, monedas y listas de precios */}
      {steps.step === CUSTOMER_STEP && (
        <FormStepPanel step={steps.step} direction={steps.direction}>
          <section className="grid gap-2">
            <Label>Cliente</Label>
            <CustomerPicker value={customer} onChange={setCustomer} canManage={canManage} emptyLabel="Elegir un cliente guardado" />
            {customer?.blockedReason && <StatusAlert tone="error" title={`Cliente bloqueado: ${customer.blockedReason}`} />}
            {!customer && (
              <div className="grid gap-3 rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">O escribe solo el nombre: el resto es opcional. Para convertirlo en pedido se pedirá un cliente guardado.</p>
                <ChoiceChips label="Tipo de cliente" options={KIND_OPTIONS} value={draft.kind} onChange={(v) => setDraft((d) => ({ ...d, kind: v as CustomerKind }))} />
                <FormField label={draft.kind === "company" ? "Nombre (como lo conocen)" : "Nombre"} htmlFor="q-customer-name">
                  <Input id="q-customer-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Restaurante Litoral" className="h-11 md:h-9" />
                </FormField>
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Más datos del cliente (opcional)</summary>
                  <div className="mt-3 grid gap-3">
                    {draft.kind === "company" && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField label="Razón social" htmlFor="q-legal" optional>
                          <Input id="q-legal" value={draft.legalName} onChange={(e) => setDraft((d) => ({ ...d, legalName: e.target.value }))} className="h-11 md:h-9" />
                        </FormField>
                        <FormField label="RIF" htmlFor="q-rif" optional>
                          <Input id="q-rif" value={draft.taxId} onChange={(e) => setDraft((d) => ({ ...d, taxId: e.target.value }))} placeholder="J-12345678-9" className="h-11 md:h-9" />
                        </FormField>
                        <FormField label="Persona de contacto" htmlFor="q-contact" optional>
                          <Input id="q-contact" value={draft.contactPerson} onChange={(e) => setDraft((d) => ({ ...d, contactPerson: e.target.value }))} className="h-11 md:h-9" />
                        </FormField>
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField label="Teléfono" htmlFor="q-phone" optional>
                        <Input id="q-phone" type="tel" inputMode="tel" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="0414-123.45.67" className="h-11 md:h-9" />
                      </FormField>
                      <FormField label="Correo" htmlFor="q-email" optional>
                        <Input id="q-email" type="email" inputMode="email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} className="h-11 md:h-9" />
                      </FormField>
                    </div>
                    <FormField label="Dirección" htmlFor="q-address" optional>
                      <Input id="q-address" value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} className="h-11 md:h-9" />
                    </FormField>
                  </div>
                </details>
              </div>
            )}
          </section>
          {pricing.agreement && (
            <p className="rounded-lg border p-3 text-sm">
              Tiene acuerdo: sus precios especiales y sus productos exclusivos se aplican solos, sin descuento al mayor.
              {pricing.eurRate && " Sus Bs van a tasa euro."}
            </p>
          )}
          <section className="grid gap-3">
            <FormField label="Monedas" htmlFor="q-currencies">
              <ChoiceChips id="q-currencies" label="Monedas" options={CURRENCY_OPTIONS} value={currencies} onChange={(v) => setCurrencies(v as QuoteCurrencies)} />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              {useUsd && (
                <FormField label="Lista de precios en USD" htmlFor="q-usd-list">
                  {listSelect("q-usd-list", usdListId, setUsdListId, usdLists)}
                </FormField>
              )}
              {useVes && (
                <FormField label="Lista de precios en Bs" htmlFor="q-ves-list" hint="Montos en Bs a la tasa BCV del día (referencial).">
                  {listSelect("q-ves-list", vesListId, setVesListId, vesLists)}
                </FormField>
              )}
            </div>
          </section>
        </FormStepPanel>
      )}

      {/* 2. Productos (con su descuento por línea) e imágenes */}
      {steps.step === PRODUCTS_STEP && (
        <FormStepPanel step={steps.step} direction={steps.direction}>
          <section className="grid gap-2">
            <Label>Productos</Label>
            {/* En un presupuesto no se aparta inventario: sin stock. Precio de la lista en USD (o en Bs). */}
            <ProductPicker variants={pricing.visible} priceMethodId={usdList?.id ?? vesList?.id} onAdd={addVariant} onCombo={setComboToPick} />

            {lines.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {lines.map((line) => {
                  const variant = variantById.get(line.variantId)
                  const usdPrice = usdList ? variant?.pricesUsd[usdList.id] : undefined
                  const vesPrice = vesList ? variant?.pricesUsd[vesList.id] : undefined
                  return (
                    <li key={line.key} className="grid gap-2 p-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200">
                      <div className="grid min-w-0 gap-0.5">
                        <span className="text-sm font-medium">
                          {variant?.productName ?? "Producto"} <span className="font-normal text-muted-foreground">· {variant?.variantLabel}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {[
                            useUsd && (usdPrice === undefined ? "Sin precio USD" : `${usd(usdPrice)} c/u`),
                            useVes && (vesPrice === undefined ? "Sin precio Bs" : `${bs(vesPrice * bcv)} c/u`),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
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
                                      {piece && piece.extraUsd > 0 && ` · +${usd(piece.extraUsd * c.quantity)}`}
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
                      <div className="flex flex-wrap items-center gap-2">
                        {line.components ? (
                          <>
                            <StatusBadge tone="info">
                              {line.quantity} {line.quantity === 1 ? "combo" : "combos"}
                            </StatusBadge>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setQuantity(line.key, 0)}>
                              <Trash2Icon aria-hidden />
                              Quitar
                            </Button>
                          </>
                        ) : (
                          <>
                            <QuantityStepper removable value={line.quantity} onChange={(q) => setQuantity(line.key, q)} />
                            <Button type="button" variant="outline" size="sm" onClick={() => setCustomizing(line.key)}>
                              <PaletteIcon aria-hidden />
                              Personalizar
                            </Button>
                          </>
                        )}
                        <div className="flex items-center gap-1">
                          <Input
                            aria-label="Descuento de la línea (%)"
                            inputMode="decimal"
                            value={line.discountPercent}
                            onChange={(e) => updateLine(line.key, { discountPercent: e.target.value })}
                            placeholder="0"
                            className="h-10 w-16 text-right tabular-nums md:h-8"
                          />
                          <span className="text-xs text-muted-foreground">% desc.</span>
                        </div>
                      </div>
                      <CustomizationList
                        customizations={line.customizations}
                        typeName={(id) => typeById.get(id)?.name}
                        onRemove={(key) => removeCustomization(line.key, null, key)}
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="grid gap-2">
            <Label>
              Imágenes <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <QuoteImagesField
              images={images}
              onChange={setImages}
              catalog={catalogImages}
              productIds={[...new Set(lines.flatMap((l) => [variantById.get(l.variantId)?.productId ?? "", ...(l.components ?? []).map((c) => variantById.get(c.variantId)?.productId ?? "")]))]}
              storageEnabled={storageEnabled}
            />
          </section>
        </FormStepPanel>
      )}

      {/* 3. Condiciones: vencimiento, descuento, opciones, encabezado y notas */}
      {steps.step === CONDITIONS_STEP && (
        <FormStepPanel step={steps.step} direction={steps.direction}>
          <FormField label="Vence el" htmlFor="q-valid" hint={`Por defecto, ${settings.validityDays} días.`}>
            <DateField id="q-valid" min={today} value={validUntil} onChange={setValidUntil} className="max-w-80" />
          </FormField>

          <section className="grid gap-3">
            <FormField label="Descuento del presupuesto" htmlFor="q-discount">
              <ChoiceChips id="q-discount" label="Descuento" options={DISCOUNT_OPTIONS} value={discountMode} onChange={(v) => setDiscountMode(v as DiscountMode)} />
            </FormField>
            {discountMode !== "none" && (
              <FormField label={discountMode === "percent" ? "Porcentaje" : "Monto en USD"} htmlFor="q-discount-value">
                <Input id="q-discount-value" inputMode="decimal" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="h-11 max-w-32 md:h-9" />
              </FormField>
            )}
            {needsReason && (
              <FormField
                label="Motivo del descuento"
                htmlFor="q-discount-reason"
                hint={staffLimit !== null ? `Sin owner o admin, hasta ${staffLimit}% (por línea o en total).` : undefined}
              >
                <Input id="q-discount-reason" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="Pedido grande" className="h-11 md:h-9" />
              </FormField>
            )}
          </section>

          {/* Opciones */}
          <section className="grid gap-2">
            <SwitchRow label={`Agregar IVA (${settings.vatPercent}%)`} description="Se suma al total, después de descuentos." checked={vatEnabled} onChange={setVatEnabled} />
            <SwitchRow label="Nota de IGTF" description="Solo texto para pagos en divisas." checked={igtfEnabled} onChange={setIgtfEnabled} />
            <SwitchRow label="Agrupar por talla" description="Para pedidos grandes: una fila por producto con el desglose de tallas." checked={groupBySize} onChange={setGroupBySize} />
          </section>

          {storageEnabled && (
            <FormField label="Imagen del encabezado" htmlFor="q-header">
              <QuoteHeaderField imageUrl={header?.url ?? companyHeaderUrl} hasCustomImage={Boolean(header)} enabled={storageEnabled} onChange={setHeader} />
            </FormField>
          )}

          <FormField label="Notas y condiciones" htmlFor="q-terms">
            <Textarea id="q-terms" rows={6} maxLength={3000} value={terms} onChange={(e) => setTerms(e.target.value)} />
          </FormField>
        </FormStepPanel>
      )}

      {/* 4. Revisar y guardar */}
      {steps.step === REVIEW_STEP && (
        <FormStepPanel step={steps.step} direction={steps.direction}>
          <div className="divide-y rounded-lg border px-3">
            {reviewRow(
              "Cliente y listas",
              [
                customer?.name ?? (draft.name.trim() || "—"),
                QUOTE_CURRENCIES_LABELS[currencies],
                useUsd && usdList?.name,
                useVes && vesList?.name,
              ]
                .filter(Boolean)
                .join(" · "),
              CUSTOMER_STEP
            )}
            {reviewRow(
              "Productos",
              [
                lines.map((l) => `${l.quantity} × ${variantById.get(l.variantId)?.productName ?? "Producto"}`).join(", ") || "—",
                images.length > 0 && `${images.length} ${images.length === 1 ? "imagen" : "imágenes"}`,
              ]
                .filter(Boolean)
                .join(" · "),
              PRODUCTS_STEP
            )}
            {reviewRow(
              "Condiciones",
              [
                `vence el ${validUntil.split("-").reverse().join("/")}`,
                vatEnabled && `IVA ${settings.vatPercent}%`,
                igtfEnabled && "nota de IGTF",
                groupBySize && "agrupado por talla",
              ]
                .filter(Boolean)
                .join(" · "),
              CONDITIONS_STEP
            )}
          </div>
          <div className="grid gap-3 rounded-lg border p-3">
            {[
              usdTotals && { label: "USD", totals: usdTotals, fmt: usd },
              vesTotals && { label: "Bs", totals: vesTotals, fmt: (v: number) => bs(v * bcv) },
            ]
              .filter(Boolean)
              .map((block) => {
                const { label, totals, fmt } = block as { label: string; totals: NonNullable<typeof usdTotals>; fmt: (v: number) => string }
                return (
                  <dl key={label} className="grid gap-1 text-sm tabular-nums">
                    {currencies === "both" && <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>}
                    <div className="flex justify-between text-muted-foreground">
                      <dt>Subtotal</dt>
                      <dd>{fmt(totals.subtotal)}</dd>
                    </div>
                    {totals.volumeDiscount > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <dt>
                          Al mayor ({totals.pieces} piezas, {totals.volumePercent}%)
                        </dt>
                        <dd>−{fmt(totals.volumeDiscount)}</dd>
                      </div>
                    )}
                    {totals.discount > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <dt>Descuento</dt>
                        <dd>−{fmt(totals.discount)}</dd>
                      </div>
                    )}
                    {totals.vat > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <dt>IVA {settings.vatPercent}%</dt>
                        <dd>{fmt(totals.vat)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold">
                      <dt>Total {label}</dt>
                      <dd>{fmt(totals.total)}</dd>
                    </div>
                  </dl>
                )
              })}
            {useVes && !bcv && <p className="text-xs text-muted-foreground">Falta la tasa de hoy: el monto en Bs se calcula al registrarla.</p>}
          </div>
        </FormStepPanel>
      )}

      {/* Barra de abajo: lo que falta y avanzar o guardar. */}
      <FormStepperFooter
        steps={QUOTE_STEPS}
        current={steps.step}
        onBack={steps.back}
        onNext={steps.next}
        nextDisabled={stepBlockers[steps.step].length > 0}
        submitLabel={pending ? "Guardando…" : quote ? "Guardar cambios" : "Guardar borrador"}
        submitting={pending}
        submitDisabled={pending || blockers.length > 0}
        onSubmit={submit}
        total={
          usdTotals || vesTotals
            ? [usdTotals && usd(usdTotals.total), vesTotals && bcv > 0 && bs(vesTotals.total * bcv)].filter(Boolean).join(" · ")
            : undefined
        }
        alert={
          <>
            {error ? (
              <StatusAlert tone="error" title={error} />
            ) : (
              (lines.length > 0 || steps.step !== PRODUCTS_STEP) &&
              currentBlockers[0] && (
                <StatusAlert tone="warning" title={currentBlockers[0]}>
                  {steps.isLast && firstBlockedStep >= 0 && firstBlockedStep < REVIEW_STEP && (
                    <Button type="button" variant="link" className="h-auto p-0" onClick={() => steps.goTo(firstBlockedStep)}>
                      Ir a {QUOTE_STEPS[firstBlockedStep].title}
                    </Button>
                  )}
                </StatusAlert>
              )
            )}
          </>
        }
      />

      <ComboPickerDialog
        combo={comboToPick}
        variants={pricing.visible}
        // En un presupuesto no se aparta inventario: no hay límite de piezas.
        available={() => Number.MAX_SAFE_INTEGER}
        onCancel={() => setComboToPick(null)}
        onConfirm={(selection) => {
          const combo = comboToPick
          setComboToPick(null)
          if (!combo) return
          setLines((prev) => [
            ...prev,
            {
              key: crypto.randomUUID(),
              variantId: combo.id,
              quantity: selection.quantity,
              discountPercent: "",
              components: selection.components.map((c) => ({ ...c, customizations: [] })),
              customizations: [],
            },
          ])
        }}
      />
      <CustomizationDialog
        key={customizing ?? "none"}
        open={Boolean(customizingLine)}
        mode="quote"
        lineLabel={
          customizingPiece
            ? `${customizingPiece.quantity} × ${customizingPieceVariant?.productName} · ${customizingPieceVariant?.variantLabel} (${customizingVariant?.productName})`
            : customizingLine && customizingVariant
              ? `${customizingLine.quantity} × ${customizingVariant.productName} · ${customizingVariant.variantLabel}`
              : ""
        }
        lineQuantity={customizingPiece?.quantity ?? customizingLine?.quantity ?? 1}
        types={customizationTypes}
        storageEnabled={false}
        onClose={() => setCustomizing(null)}
        onSave={(c) => {
          addCustomization(c)
          setCustomizing(null)
        }}
      />
    </div>
  )
}

export default QuoteForm

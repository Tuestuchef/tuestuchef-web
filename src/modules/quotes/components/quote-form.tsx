"use client"

import { Loader2Icon, MinusIcon, PackagePlusIcon, PaletteIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useMemo, useState, useTransition } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/common/components/ui/select"
import { Switch } from "@/common/components/ui/switch"
import { Textarea } from "@/common/components/ui/textarea"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"
import CustomerPicker, { type PickedCustomer } from "@/modules/customers/components/customer-picker"
import { CUSTOMER_KIND_LABELS } from "@/modules/customers/lib/constants/customers.constants"
import { formatPhone, formatTaxId } from "@/modules/customers/lib/utils/normalize-contact.util"
import CustomizationDialog, { type LineCustomization } from "@/modules/orders/components/customization-dialog"
import ComboPickerDialog, { type ComboSelection } from "@/modules/sales/components/combo-picker-dialog"
import type { SellableVariant } from "@/modules/sales/lib/types/sales.types"

import { saveQuoteDraftAction } from "../lib/actions/quotes.action"
import { QUOTE_CURRENCIES_LABELS } from "../lib/constants/quotes.constants"
import type { CustomerKind, DiscountType, QuoteCurrencies, QuoteDetail, QuoteFormData } from "../lib/types/quotes.types"
import { customizationTotal, quoteTotals } from "../lib/utils/quote-math.util"

type QuoteLine = {
  key: string
  variantId: string
  quantity: number
  discountPercent: string
  components?: ComboSelection["components"]
  customizations: LineCustomization[]
}

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
          .map((c) => ({ variantId: c.variantId, quantity: c.quantity, source: "made_to_order" as const })),
      }),
      customizations: item.customizations.map((c) => ({
        key: c.id,
        typeId: c.typeId,
        quantity: c.quantity,
        text: c.text ?? undefined,
        position: c.position ?? undefined,
        sizeCm: c.sizeCm ?? undefined,
        note: c.note ?? undefined,
      })),
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

type QuoteFormProps = QuoteFormData & { canManage: boolean; quote?: QuoteDetail }

// Crear o editar un presupuesto (borrador). La base vuelve a calcular precios y totales al guardar.
const QuoteForm = ({
  variants,
  rates,
  staffMaxDiscountPercent,
  volumeTiers,
  today,
  customizationTypes,
  customizationTiers,
  priceLists,
  settings,
  canManage,
  quote,
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
  const [pickerOpen, setPickerOpen] = useState(false)
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

  const variantById = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants])
  const typeById = useMemo(() => new Map(customizationTypes.map((t) => [t.id, t])), [customizationTypes])
  const usdLists = priceLists.filter((l) => l.currency === "USD")
  const vesLists = priceLists.filter((l) => l.currency === "VES")
  const useUsd = currencies !== "ves"
  const useVes = currencies !== "usd"
  const usdList = usdLists.find((l) => l.id === usdListId)
  const vesList = vesLists.find((l) => l.id === vesListId)

  // ---- Totales (vista previa; la base decide) ----
  const allCustomizations = lines.flatMap((l) => l.customizations)
  const custom = customizationTotal(allCustomizations, (id) => typeById.get(id)?.unitPriceUsd ?? 0, customizationTiers)
  const mathLines = (listId: string | undefined) =>
    lines.map((line) => ({
      quantity: line.quantity,
      discountPercent: parseAmount(line.discountPercent) ?? 0,
      price: listId ? variantById.get(line.variantId)?.pricesUsd[listId] : undefined,
      pieces: line.components ? line.components.reduce((s, c) => s + c.quantity, 0) : line.quantity,
    }))
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
  const bcv = rates?.bcvUsd ?? 0

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

  const blockers = [
    !customer && !draft.name.trim() && "Elige un cliente o escribe su nombre.",
    customer?.blockedReason && `Cliente bloqueado: no puede recibir presupuestos (${customer.blockedReason}).`,
    lines.length === 0 && "Agrega al menos un producto.",
    useUsd && !usdList && "Elige la lista de precios en USD.",
    useVes && !vesList && "Elige la lista de precios en Bs.",
    missingPrice,
    belowMinimum,
    validUntil < today && "La fecha de vencimiento no puede ser pasada.",
    needsReason && !discountReason.trim() && "Indica el motivo del descuento.",
    staffLimit !== null && lines.some((l) => (parseAmount(l.discountPercent) ?? 0) > staffLimit) && `El descuento máximo sin owner o admin es ${staffLimit}%.`,
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
      return [...prev, { key: crypto.randomUUID(), variantId: variant.id, quantity: 1, discountPercent: "", customizations: [] }]
    })
  }
  const updateLine = (key: string, patch: Partial<QuoteLine>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const setQuantity = (key: string, quantity: number) =>
    setLines((prev) => (quantity <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, quantity } : l))))
  const customizingLine = lines.find((l) => l.key === customizing)
  const customizingVariant = customizingLine ? variantById.get(customizingLine.variantId) : undefined

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
        items: lines.map((l) => ({
          variant_id: l.variantId,
          quantity: l.quantity,
          discount_percent: parseAmount(l.discountPercent) ?? 0,
          ...(l.components && { components: l.components.map((c) => ({ variant_id: c.variantId, quantity: c.quantity })) }),
          customizations: l.customizations.map((c) => ({
            type_id: c.typeId,
            quantity: c.quantity,
            size_cm: c.sizeCm ?? null,
            position: c.position ?? null,
            text: c.text ?? null,
            note: c.note ?? null,
          })),
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

  return (
    <div className="grid gap-5">
      {/* Cliente */}
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

      {/* Monedas y listas */}
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
              <CommandInput placeholder="Filipina blanca M…" />
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
                      {variant.components && <span className="text-xs text-muted-foreground">Combo</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {lines.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {lines.map((line) => {
              const variant = variantById.get(line.variantId)
              const usdPrice = usdList ? variant?.pricesUsd[usdList.id] : undefined
              const vesPrice = vesList ? variant?.pricesUsd[vesList.id] : undefined
              return (
                <li key={line.key} className="grid gap-2 p-3">
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
                            className="h-10 w-16 border-0 text-center tabular-nums shadow-none md:h-8"
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
                  {line.customizations.length > 0 && (
                    <ul className="grid gap-1 border-l-2 pl-2 text-xs">
                      {line.customizations.map((c) => (
                        <li key={c.key} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate">
                            {c.quantity} × {typeById.get(c.typeId)?.name}
                            {c.text ? ` · "${c.text}"` : ""}
                            {c.sizeCm ? ` · ${c.sizeCm} cm` : ""}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => updateLine(line.key, { customizations: line.customizations.filter((x) => x.key !== c.key) })}
                          >
                            <XIcon aria-hidden />
                            <span className="sr-only">Quitar personalización</span>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Vencimiento y descuento */}
      <FormField label="Vence el" htmlFor="q-valid" hint={`Por defecto, ${settings.validityDays} días.`}>
        <Input id="q-valid" type="date" min={today} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-11 max-w-48 md:h-9" />
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

      <FormField label="Notas y condiciones" htmlFor="q-terms">
        <Textarea id="q-terms" rows={6} maxLength={3000} value={terms} onChange={(e) => setTerms(e.target.value)} />
      </FormField>

      {/* Resumen */}
      <div className="sticky bottom-0 -mx-4 grid gap-3 border-t bg-background p-4 md:static md:mx-0 md:rounded-lg md:border">
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
        {error ? <StatusAlert tone="error" title={error} /> : lines.length > 0 && blockers[0] && <StatusAlert tone="warning" title={blockers[0]} />}
        <Button type="button" className="h-12 text-base" disabled={pending || blockers.length > 0} onClick={submit}>
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          {pending ? "Guardando…" : quote ? "Guardar cambios" : "Guardar borrador"}
        </Button>
      </div>

      <ComboPickerDialog
        combo={comboToPick}
        variants={variants}
        // En un presupuesto no se aparta inventario: no hay límite de piezas.
        available={() => Number.MAX_SAFE_INTEGER}
        onCancel={() => setComboToPick(null)}
        onConfirm={(selection) => {
          const combo = comboToPick
          setComboToPick(null)
          if (!combo) return
          setLines((prev) => [
            ...prev,
            { key: crypto.randomUUID(), variantId: combo.id, quantity: selection.quantity, discountPercent: "", components: selection.components, customizations: [] },
          ])
        }}
      />
      <CustomizationDialog
        key={customizing ?? "none"}
        open={Boolean(customizingLine)}
        mode="quote"
        lineLabel={customizingLine && customizingVariant ? `${customizingLine.quantity} × ${customizingVariant.productName} · ${customizingVariant.variantLabel}` : ""}
        lineQuantity={customizingLine?.quantity ?? 1}
        types={customizationTypes}
        storageEnabled={false}
        onClose={() => setCustomizing(null)}
        onSave={(c) => {
          if (customizing) updateLine(customizing, { customizations: [...(customizingLine?.customizations ?? []), c] })
          setCustomizing(null)
        }}
      />
    </div>
  )
}

export default QuoteForm

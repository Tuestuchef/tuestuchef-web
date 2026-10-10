"use client"

import { ClipboardListIcon, Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import ChoiceChips from "@/common/components/choice-chips"
import DateField from "@/common/components/date-field"
import FormField from "@/common/components/form-field"
import ReceiptField from "@/common/components/receipt-field"
import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/common/components/ui/dialog"
import { Input } from "@/common/components/ui/input"
import { Label } from "@/common/components/ui/label"
import { Textarea } from "@/common/components/ui/textarea"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import CustomerPicker, { type PickedCustomer } from "@/modules/customers/components/customer-picker"
import { STOCK_MODE_LABELS, type OrderStockMode } from "@/modules/orders/lib/constants/orders.constants"
import { CHANNEL_LABELS, DELIVERY_LABELS, MANUAL_CHANNELS, type DeliveryMethod, type SaleChannel } from "@/modules/sales/lib/constants/sales.constants"

import { convertQuoteAction } from "../lib/actions/quotes.action"
import type { QuoteCurrencies } from "../lib/types/quotes.types"

export type ConvertCustomization = {
  id: string
  label: string
  quantity: number
  requiresText: boolean
  requiresLogo: boolean
  text: string | null
}

type QuoteConvertDialogProps = {
  quoteId: string
  code: string
  currencies: QuoteCurrencies
  totals: { usd: number; vesBs: number }
  customer: PickedCustomer | null
  canManage: boolean
  promisedDefault: string
  today: string
  storageEnabled: boolean
  customizations: ConvertCustomization[]
}

type Detail = { names: string; text: string; logoPath: string | null }

// Convertir en pedido: copia cliente, líneas y precios del presupuesto. Pide lo que el pedido necesita
// y el presupuesto no tenía: cliente guardado, moneda de pago, inventario, fecha, y nombres o logo.
const QuoteConvertDialog = ({
  quoteId,
  code,
  currencies,
  totals,
  customer: quoteCustomer,
  canManage,
  promisedDefault,
  today,
  storageEnabled,
  customizations,
}: QuoteConvertDialogProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [customer, setCustomer] = useState<PickedCustomer | null>(quoteCustomer)
  const [currency, setCurrency] = useState<"usd" | "ves">(currencies === "ves" ? "ves" : "usd")
  const [stockMode, setStockMode] = useState<OrderStockMode>("reserve_and_produce")
  const [promisedDate, setPromisedDate] = useState(promisedDefault)
  const [channel, setChannel] = useState<SaleChannel>("whatsapp")
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("pickup")
  const [details, setDetails] = useState<Record<string, Detail>>(() =>
    Object.fromEntries(customizations.map((c) => [c.id, { names: "", text: c.text ?? "", logoPath: null }]))
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const needDetails = customizations.filter((c) => c.requiresText || c.requiresLogo)
  const nameList = (value: string) =>
    value
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean)

  const problem = (() => {
    if (!customer) return "Elige o crea el cliente: un pedido necesita cliente."
    if (customer.blockedReason) return `Cliente bloqueado: ${customer.blockedReason}`
    if (promisedDate < today) return "La fecha prometida no puede ser pasada."
    for (const c of needDetails) {
      const d = details[c.id]
      const names = nameList(d.names)
      if (c.requiresText && !d.text.trim() && names.length === 0) return `"${c.label}": escribe el texto o los nombres.`
      if (names.length > 0 && names.length !== c.quantity) return `"${c.label}": van ${names.length} nombres para ${c.quantity} piezas.`
      if (c.requiresLogo && !d.logoPath) return `"${c.label}": sube el logo.`
    }
    return null
  })()

  const convert = () => {
    setError(null)
    startTransition(async () => {
      const result = await convertQuoteAction({
        id: quoteId,
        customer_id: customer?.id ?? null,
        currency,
        stock_mode: stockMode,
        promised_date: promisedDate,
        channel,
        delivery_method: deliveryMethod,
        details: Object.fromEntries(
          needDetails.map((c) => {
            const d = details[c.id]
            return [c.id, { text: d.text, names: nameList(d.names), logo_path: d.logoPath }]
          })
        ),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(result.message)
      router.push(ROUTES.ORDER(result.saleId))
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 md:h-9">
          <ClipboardListIcon aria-hidden />
          Convertir en pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convertir {code} en pedido</DialogTitle>
          <DialogDescription>Se copian el cliente, las líneas, la personalización y los precios del presupuesto. Solo se convierte una vez.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Cliente</Label>
            {quoteCustomer ? (
              <p className="text-sm">{quoteCustomer.name}</p>
            ) : (
              <CustomerPicker value={customer} onChange={setCustomer} canManage={canManage} emptyLabel="Elige o crea el cliente" />
            )}
          </div>

          {currencies === "both" ? (
            <FormField label="El cliente paga con la lista" htmlFor="qc-currency">
              <ChoiceChips
                id="qc-currency"
                label="Moneda de pago"
                value={currency}
                onChange={(v) => setCurrency(v as "usd" | "ves")}
                options={[
                  { value: "usd", label: "USD", hint: formatMoney(totals.usd, "USD") },
                  { value: "ves", label: "Bs", hint: formatMoney(totals.vesBs, "VES") },
                ]}
              />
            </FormField>
          ) : (
            <p className="text-sm">
              Total del pedido: <span className="font-medium">{currency === "usd" ? formatMoney(totals.usd, "USD") : formatMoney(totals.vesBs, "VES")}</span>
            </p>
          )}

          <FormField label="Inventario" htmlFor="qc-stock">
            <ChoiceChips
              id="qc-stock"
              label="Modo de inventario"
              value={stockMode}
              onChange={(v) => setStockMode(v as OrderStockMode)}
              options={(Object.keys(STOCK_MODE_LABELS) as OrderStockMode[]).map((mode) => ({ value: mode, label: STOCK_MODE_LABELS[mode].title }))}
            />
          </FormField>
          <FormField label="Fecha prometida" htmlFor="qc-date">
            <DateField id="qc-date" min={today} value={promisedDate} onChange={setPromisedDate} />
          </FormField>
          {/* Uno debajo del otro: lado a lado, en el ancho del diálogo los botones se deforman. */}
          <div className="grid gap-4">
            <FormField label="Canal" htmlFor="qc-channel">
              <ChoiceChips id="qc-channel" label="Canal" value={channel} onChange={(v) => setChannel(v as SaleChannel)} options={MANUAL_CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))} />
            </FormField>
            <FormField label="Entrega" htmlFor="qc-delivery">
              <ChoiceChips
                id="qc-delivery"
                label="Entrega"
                value={deliveryMethod}
                onChange={(v) => setDeliveryMethod(v as DeliveryMethod)}
                options={(["pickup", "delivery"] as const).map((d) => ({ value: d, label: DELIVERY_LABELS[d] }))}
              />
            </FormField>
          </div>

          {needDetails.length > 0 && (
            <section className="grid gap-3">
              <Label>Personalización</Label>
              {needDetails.map((c) => (
                <div key={c.id} className="grid gap-2 rounded-lg border p-3">
                  <span className="text-sm font-medium">
                    {c.label} · {c.quantity} {c.quantity === 1 ? "pieza" : "piezas"}
                  </span>
                  {c.requiresText && (
                    <>
                      <Input
                        aria-label={`Texto de ${c.label}`}
                        value={details[c.id].text}
                        onChange={(e) => setDetails((all) => ({ ...all, [c.id]: { ...all[c.id], text: e.target.value } }))}
                        placeholder="Texto igual en todas (opcional)"
                        className="h-11 md:h-9"
                      />
                      <Textarea
                        aria-label={`Nombres de ${c.label}`}
                        rows={3}
                        value={details[c.id].names}
                        onChange={(e) => setDetails((all) => ({ ...all, [c.id]: { ...all[c.id], names: e.target.value } }))}
                        placeholder={"O un nombre por pieza, uno por línea\nAna\nLuis"}
                      />
                    </>
                  )}
                  {c.requiresLogo && (
                    <ReceiptField
                      enabled={storageEnabled}
                      label="Logo (JPG, PNG o PDF)"
                      onPathChange={(path) => setDetails((all) => ({ ...all, [c.id]: { ...all[c.id], logoPath: path } }))}
                    />
                  )}
                </div>
              ))}
            </section>
          )}

          {(error ?? problem) && <StatusAlert tone={error ? "error" : "warning"} title={error ?? problem ?? ""} />}
        </div>

        <DialogFooter>
          <Button className="h-11 md:h-9" disabled={pending || Boolean(problem)} onClick={convert}>
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Crear el pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default QuoteConvertDialog

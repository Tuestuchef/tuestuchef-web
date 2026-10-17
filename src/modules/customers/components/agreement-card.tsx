"use client"

import { HandshakeIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useDeferredValue, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import ChoiceChips from "@/common/components/choice-chips"
import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import StatusBadge from "@/common/components/status-badge"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/common/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/common/components/ui/dialog"
import { Input } from "@/common/components/ui/input"
import { Textarea } from "@/common/components/ui/textarea"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { cn } from "@/common/lib/utils"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"
import { normalizeSearch, searchList } from "@/common/lib/utils/search.util"

import {
  deleteAgreementAction,
  deleteAgreementPriceAction,
  saveAgreementPriceAction,
  saveAgreementSettingsAction,
} from "../lib/actions/agreements.action"
import type { AgreementProductOption, CustomerAgreementDetail } from "../lib/services/agreements.service"
import type { AgreementVesRateKind } from "../lib/types/agreements.types"

const VES_RATE_LABELS: Record<AgreementVesRateKind, string> = { bcv_usd: "Tasa BCV dólar", bcv_eur: "Tasa BCV euro" }

type AgreementCardProps = {
  customerId: string
  agreement: CustomerAgreementDetail
  products: AgreementProductOption[]
  canManage: boolean
}

type Rule = CustomerAgreementDetail["prices"][number]

const percentFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 })
const ruleText = (rule: Pick<Rule, "discountPercent" | "fixedPriceUsd">) =>
  rule.fixedPriceUsd !== null ? `${formatMoney(rule.fixedPriceUsd, "USD")} fijo` : `${percentFormat.format(rule.discountPercent ?? 0)} % menos`

type Result = { ok: true; message: string } | { ok: false; error: string }

// Acuerdo de un cliente fijo: % general, precios por producto o combo y sus exclusivos.
// Todos lo ven; solo owner y admin lo cambian.
const AgreementCard = ({ customerId, agreement, products, canManage }: AgreementCardProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editing, setEditing] = useState<Rule | "new" | null>(null)
  const [pending, startTransition] = useTransition()

  if (!agreement.exists && agreement.exclusives.length === 0 && !canManage) return null

  const run = (action: () => Promise<Result>) =>
    startTransition(async () => {
      const result = await action()
      if (result.ok) toast.success(result.message)
      else toast.error(result.error)
    })

  // Productos que pueden llevar precio: los generales y los exclusivos de este cliente.
  const options = products.filter((p) => !p.exclusiveCustomerId || p.exclusiveCustomerId === customerId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HandshakeIcon className="size-4" aria-hidden />
          Acuerdo
        </CardTitle>
        <CardDescription>
          {agreement.exists
            ? "Precios especiales que se aplican solos al venderle, cotizarle o hacerle un pedido. Con acuerdo no lleva descuento al mayor."
            : "Sin acuerdo: paga precios normales y descuento al mayor."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        {agreement.exists && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Descuento general:{" "}
              <span className="font-medium">
                {agreement.generalDiscountPercent !== null ? `${percentFormat.format(agreement.generalDiscountPercent)} %` : "ninguno"}
              </span>
              <span className="block text-xs text-muted-foreground">Para todo lo que no tenga su propio precio abajo.</span>
              <span className="mt-2 block">
                Pagos en Bs: <span className="font-medium">{VES_RATE_LABELS[agreement.vesRateKind]}</span>
              </span>
              <span className="block text-xs text-muted-foreground">
                {agreement.vesRateKind === "bcv_eur"
                  ? "Todos sus pagos en Bs se calculan a la BCV euro, sea cual sea el método."
                  : "Cada método en Bs usa su propia tasa."}
              </span>
            </span>
            {canManage && (
              <Button type="button" variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                <PencilIcon aria-hidden />
                Editar
              </Button>
            )}
          </div>
        )}
        {agreement.notes && <p className="whitespace-pre-line text-muted-foreground">{agreement.notes}</p>}

        {agreement.prices.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {agreement.prices.map((rule) => (
              <li key={rule.id} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate">
                  {rule.productName}
                  {rule.isCombo && <span className="text-muted-foreground"> · combo</span>}
                </span>
                <span className="font-medium tabular-nums">{ruleText(rule)}</span>
                {canManage && (
                  <>
                    <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setEditing(rule)}>
                      <PencilIcon aria-hidden />
                      <span className="sr-only">Editar precio de {rule.productName}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={pending}
                      onClick={() => run(() => deleteAgreementPriceAction(rule.id))}
                    >
                      <Trash2Icon aria-hidden />
                      <span className="sr-only">Quitar precio de {rule.productName}</span>
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing("new")}>
              <PlusIcon aria-hidden />
              Precio de un producto o combo
            </Button>
            {!agreement.exists && (
              <Button type="button" variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                <HandshakeIcon aria-hidden />
                Crear acuerdo
              </Button>
            )}
            {agreement.exists && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (window.confirm("¿Quitar el acuerdo? El cliente vuelve a precios normales y descuento al mayor.")) {
                    run(() => deleteAgreementAction(customerId))
                  }
                }}
              >
                <Trash2Icon aria-hidden />
                Quitar acuerdo
              </Button>
            )}
          </div>
        )}

        <div className="grid gap-1">
          <span className="font-medium">Exclusivos</span>
          {agreement.exclusives.length === 0 ? (
            <span className="text-muted-foreground">
              Ninguno. Un producto o combo se marca como exclusivo de este cliente desde su ficha en el Catálogo.
            </span>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {agreement.exclusives.map((p) => (
                <li key={p.id}>
                  <Link href={ROUTES.PRODUCT(p.id)} className="inline-flex underline-offset-4 hover:underline">
                    <StatusBadge tone="info">
                      {p.name}
                      {p.isCombo ? " · combo" : ""}
                      {!p.isActive ? " · inactivo" : ""}
                    </StatusBadge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>

      {canManage && (
        <SettingsDialog
          key={`settings-${settingsOpen}`}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          customerId={customerId}
          percent={agreement.generalDiscountPercent}
          vesRateKind={agreement.vesRateKind}
          notes={agreement.notes}
        />
      )}
      {canManage && editing && (
        <PriceDialog
          key={editing === "new" ? "new" : editing.id}
          customerId={customerId}
          rule={editing === "new" ? null : editing}
          options={options}
          taken={new Set(agreement.prices.map((p) => p.productId))}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  )
}

const SettingsDialog = ({
  open,
  onClose,
  customerId,
  percent,
  vesRateKind,
  notes,
}: {
  open: boolean
  onClose: () => void
  customerId: string
  percent: number | null
  vesRateKind: AgreementVesRateKind
  notes: string | null
}) => {
  const [rateKind, setRateKind] = useState<AgreementVesRateKind>(vesRateKind)
  const [value, setValue] = useState(percent !== null ? String(percent).replace(".", ",") : "")
  const [text, setText] = useState(notes ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = value.trim() ? parseAmount(value) : null
    if (value.trim() && (parsed === null || parsed <= 0 || parsed >= 100)) {
      setError("El % va de 0 a 100 (o déjalo vacío).")
      return
    }
    startTransition(async () => {
      const result = await saveAgreementSettingsAction({
        customer_id: customerId,
        general_discount_percent: parsed,
        ves_rate_kind: rateKind,
        notes: text.trim() || null,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(result.message)
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acuerdo del cliente</DialogTitle>
          <DialogDescription>El descuento general aplica a todo lo que no tenga su propio precio en el acuerdo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <FormField label="Descuento general (%)" htmlFor="agreement-percent" optional hint="Vacío: solo los precios por producto.">
            <Input id="agreement-percent" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="10" className="h-11 md:h-9" />
          </FormField>
          <FormField label="Pagos en Bs" htmlFor="agreement-ves-rate" hint="Con tasa euro, sus pagos en Bs (ventas, pedidos y abonos) y sus presupuestos en Bs usan la BCV euro con cualquier método.">
            <ChoiceChips
              id="agreement-ves-rate"
              label="Pagos en Bs"
              value={rateKind}
              onChange={(v) => setRateKind(v as AgreementVesRateKind)}
              options={(Object.keys(VES_RATE_LABELS) as AgreementVesRateKind[]).map((k) => ({ value: k, label: VES_RATE_LABELS[k] }))}
            />
          </FormField>
          <FormField label="Notas" htmlFor="agreement-notes" optional>
            <Textarea id="agreement-notes" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Ej.: pide cada semestre, paga por transferencia" />
          </FormField>
          {error && <StatusAlert tone="error" title={error} />}
          <DialogFooter>
            <SubmitButton pending={pending}>Guardar acuerdo</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const PriceDialog = ({
  customerId,
  rule,
  options,
  taken,
  onClose,
}: {
  customerId: string
  rule: Rule | null
  options: AgreementProductOption[]
  taken: Set<string>
  onClose: () => void
}) => {
  const [productId, setProductId] = useState(rule?.productId ?? "")
  const [kind, setKind] = useState<"percent" | "fixed">(rule?.fixedPriceUsd != null ? "fixed" : "percent")
  const [value, setValue] = useState(
    rule ? String(rule.fixedPriceUsd ?? rule.discountPercent ?? "").replace(".", ",") : ""
  )
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const searchable = useMemo(
    () => options.filter((o) => !taken.has(o.id) || o.id === rule?.productId).map((o) => ({ item: o, haystack: normalizeSearch(o.name) })),
    [options, taken, rule]
  )
  const { matches } = useMemo(() => searchList(searchable, deferredQuery, 30), [searchable, deferredQuery])
  const selected = options.find((o) => o.id === productId)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = parseAmount(value)
    if (!productId) {
      setError("Elige el producto o combo.")
      return
    }
    if (parsed === null || parsed <= 0 || (kind === "percent" && parsed >= 100)) {
      setError(kind === "percent" ? "El % va de 0 a 100." : "Indica el precio en USD.")
      return
    }
    startTransition(async () => {
      const result = await saveAgreementPriceAction({ customer_id: customerId, product_id: productId, kind, value: parsed })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(result.message)
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? `Precio de ${rule.productName}` : "Precio de un producto o combo"}</DialogTitle>
          <DialogDescription>Un % de descuento sobre el precio de cada método, o un precio fijo en USD para cualquier método. El recargo por talla o color va encima.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          {rule ? (
            <p className="text-sm font-medium">{rule.productName}</p>
          ) : (
            <FormField label="Producto o combo" htmlFor="agreement-product">
              <Command shouldFilter={false} className="rounded-lg border">
                <CommandInput id="agreement-product" placeholder="Buscar…" value={query} onValueChange={setQuery} />
                <CommandList className="max-h-48">
                  <CommandEmpty>No hay coincidencias.</CommandEmpty>
                  <CommandGroup>
                    {matches.map((o) => (
                      <CommandItem key={o.id} value={o.id} onSelect={() => setProductId(o.id)} className={cn(o.id === productId && "bg-accent")}>
                        {o.name}
                        {o.isCombo && <span className="text-muted-foreground"> · combo</span>}
                        {o.exclusiveCustomerId && <span className="text-muted-foreground"> · exclusivo</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
              {selected && <p className="text-xs text-muted-foreground">Elegido: {selected.name}</p>}
            </FormField>
          )}
          <ChoiceChips
            label="Tipo de precio"
            value={kind}
            onChange={(v) => setKind(v as "percent" | "fixed")}
            options={[
              { value: "percent", label: "% de descuento" },
              { value: "fixed", label: "Precio fijo (USD)" },
            ]}
          />
          <FormField label={kind === "percent" ? "Descuento (%)" : "Precio (USD)"} htmlFor="agreement-value">
            <Input id="agreement-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === "percent" ? "15" : "12"} className="h-11 md:h-9" />
          </FormField>
          {error && <StatusAlert tone="error" title={error} />}
          <DialogFooter>
            <SubmitButton pending={pending}>Guardar precio</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default AgreementCard

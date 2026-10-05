"use client"

import { useState } from "react"

import ActiveSwitchField from "@/common/components/active-switch-field"
import ChoiceChips from "@/common/components/choice-chips"
import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Input } from "@/common/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/common/components/ui/select"
import { Textarea } from "@/common/components/ui/textarea"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"

import { saveQuoteSettingsAction } from "../lib/actions/quote-settings.action"
import { QUOTE_CURRENCIES_LABELS } from "../lib/constants/quotes.constants"
import type { PriceListOption, QuoteCurrencies, QuoteSettings } from "../lib/types/quotes.types"
import { formatQuoteNumber } from "../lib/utils/quote-number.util"

const NONE = "none"
const CURRENCY_OPTIONS = (Object.keys(QUOTE_CURRENCIES_LABELS) as QuoteCurrencies[]).map((value) => ({
  value,
  label: QUOTE_CURRENCIES_LABELS[value],
}))

type QuoteSettingsFormProps = { settings: QuoteSettings; priceLists: PriceListOption[] }

const QuoteSettingsForm = ({ settings, priceLists }: QuoteSettingsFormProps) => {
  const { state, onSubmit, pending } = useFormAction(saveQuoteSettingsAction)
  useActionFeedback(state)
  const errors = state.fieldErrors ?? {}

  const [prefix, setPrefix] = useState(settings.numberPrefix)
  const [padding, setPadding] = useState(String(settings.numberPadding))
  const [next, setNext] = useState(String(settings.nextNumber))
  const [currencies, setCurrencies] = useState<QuoteCurrencies>(settings.defaultCurrencies)
  const [usdList, setUsdList] = useState(settings.defaultUsdPriceMethodId ?? NONE)
  const [vesList, setVesList] = useState(settings.defaultVesPriceMethodId ?? NONE)

  const preview =
    /^[A-Za-z0-9-]{1,10}$/.test(prefix) && Number(padding) >= 1 && Number(next) >= 1
      ? formatQuoteNumber(prefix.toUpperCase(), Math.min(Number(padding), 10), Math.trunc(Number(next)))
      : null

  const listSelect = (id: string, value: string, onChange: (v: string) => void, currency: "USD" | "VES") => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-11 w-full md:h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Sin lista por defecto</SelectItem>
        {priceLists
          .filter((list) => list.currency === currency)
          .map((list) => (
            <SelectItem key={list.id} value={list.id}>
              {list.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  )

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

      <section className="grid gap-4">
        <h2 className="text-sm font-semibold">Numeración</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Prefijo" htmlFor="qs-prefix" error={errors.number_prefix}>
            <Input id="qs-prefix" name="number_prefix" autoCapitalize="characters" value={prefix} onChange={(e) => setPrefix(e.target.value)} className="h-11 md:h-9" />
          </FormField>
          <FormField label="Dígitos" htmlFor="qs-padding" error={errors.number_padding}>
            <Input id="qs-padding" name="number_padding" type="number" min={1} max={10} inputMode="numeric" value={padding} onChange={(e) => setPadding(e.target.value)} className="h-11 md:h-9" />
          </FormField>
          <FormField label="Siguiente número" htmlFor="qs-next" error={errors.next_number}>
            <Input id="qs-next" name="next_number" type="number" min={settings.nextNumber} inputMode="numeric" value={next} onChange={(e) => setNext(e.target.value)} className="h-11 md:h-9" />
          </FormField>
        </div>
        <p className="text-xs text-muted-foreground">
          {preview ? (
            <>
              El próximo presupuesto será <span className="font-mono font-medium text-foreground">{preview}</span>.{" "}
            </>
          ) : null}
          El siguiente número solo puede subir: así nunca se repite uno ya emitido.
        </p>
      </section>

      <section className="grid gap-4">
        <h2 className="text-sm font-semibold">Vigencia y monedas</h2>
        <FormField label="Vigencia (días)" htmlFor="qs-validity" error={errors.validity_days} hint="Fecha de vencimiento por defecto: hoy más estos días.">
          <Input id="qs-validity" name="validity_days" type="number" min={1} max={365} inputMode="numeric" defaultValue={settings.validityDays} className="h-11 max-w-32 md:h-9" />
        </FormField>
        <div className="grid gap-2">
          <span className="text-sm font-medium">Monedas por defecto</span>
          <input type="hidden" name="default_currencies" value={currencies} />
          <ChoiceChips label="Monedas por defecto" options={CURRENCY_OPTIONS} value={currencies} onChange={(v) => setCurrencies(v as QuoteCurrencies)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Lista de precios en USD" htmlFor="qs-usd-list" error={errors.default_usd_price_method_id} hint="Precios de un método de pago en dólares.">
            <input type="hidden" name="default_usd_price_method_id" value={usdList === NONE ? "" : usdList} />
            {listSelect("qs-usd-list", usdList, setUsdList, "USD")}
          </FormField>
          <FormField label="Lista de precios en Bs" htmlFor="qs-ves-list" error={errors.default_ves_price_method_id} hint="Precios de un método en Bs, a la tasa BCV de la fecha.">
            <input type="hidden" name="default_ves_price_method_id" value={vesList === NONE ? "" : vesList} />
            {listSelect("qs-ves-list", vesList, setVesList, "VES")}
          </FormField>
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-sm font-semibold">Impuestos</h2>
        <FormField label="IVA (%)" htmlFor="qs-vat" error={errors.vat_percent} hint="Se suma al total del presupuesto cuando se marca. Valídalo con tu contador.">
          <Input id="qs-vat" name="vat_percent" inputMode="decimal" defaultValue={String(settings.vatPercent)} className="h-11 max-w-32 md:h-9" />
        </FormField>
        <ActiveSwitchField name="vat_default_enabled" defaultChecked={settings.vatDefaultEnabled} label="Agregar IVA por defecto" description="Cada presupuesto puede quitarlo o agregarlo." />
        <ActiveSwitchField name="igtf_note_default" defaultChecked={settings.igtfNoteDefault} label="Mostrar la nota de IGTF por defecto" description="Solo texto: no se calcula ningún monto." />
        <FormField label="Nota de IGTF" htmlFor="qs-igtf" error={errors.igtf_note}>
          <Textarea id="qs-igtf" name="igtf_note" rows={2} maxLength={500} defaultValue={settings.igtfNote} />
        </FormField>
      </section>

      <section className="grid gap-4">
        <h2 className="text-sm font-semibold">Condiciones</h2>
        <FormField label="Notas y condiciones por defecto" htmlFor="qs-terms" error={errors.default_terms} hint="Cada presupuesto empieza con este texto y se puede ajustar.">
          <Textarea id="qs-terms" name="default_terms" rows={8} maxLength={3000} defaultValue={settings.defaultTerms} />
        </FormField>
      </section>

      <SubmitButton pending={pending} className="w-fit">
        Guardar
      </SubmitButton>
    </form>
  )
}

export default QuoteSettingsForm

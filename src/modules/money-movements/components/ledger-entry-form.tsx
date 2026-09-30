"use client"

import { ArrowDownLeftIcon, ArrowUpRightIcon, CalendarIcon } from "lucide-react"
import { useRef, useState } from "react"

import ChoiceChips from "@/common/components/choice-chips"
import FormField from "@/common/components/form-field"
import ReceiptField from "@/common/components/receipt-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import { Input } from "@/common/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/common/components/ui/select"
import { CURRENCY_SYMBOLS } from "@/common/lib/constants/currency.constants"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"
import { cn } from "@/common/lib/utils"
import { toCaracasDate } from "@/common/lib/utils/format-date.util"
import { formatMoney, formatUsdt } from "@/common/lib/utils/format-money.util"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"
import { type RateSnapshot, toUsdt } from "@/common/lib/utils/to-usdt.util"

import { createLedgerEntryAction } from "../lib/actions/create-ledger-entry.action"
import {
  EXPENSE_CATEGORY_TYPES,
  INCOME_CATEGORY_TYPES,
  type MovementDirection,
  PERSON_CATEGORY_TYPES,
  QUICK_CATEGORY_LIMIT,
} from "../lib/constants/money-movements.constants"
import type { AccountOption, CategoryOption, PersonOption } from "../lib/types/money-movements.types"

type LedgerEntryFormProps = {
  accounts: AccountOption[]
  categories: CategoryOption[]
  people: PersonOption[]
  defaultAccountId: string | null
  rates: RateSnapshot | null
  receiptsEnabled: boolean
}

const DIRECTIONS: { value: MovementDirection; label: string; icon: typeof ArrowUpRightIcon }[] = [
  { value: "expense", label: "Gasto", icon: ArrowUpRightIcon },
  { value: "income", label: "Ingreso", icon: ArrowDownLeftIcon },
]

// Registro rápido pensado para el celular: monto, cuenta (recordada), categoría (más usadas primero).
const LedgerEntryForm = ({
  accounts,
  categories,
  people,
  defaultAccountId,
  rates,
  receiptsEnabled,
}: LedgerEntryFormProps) => {
  const amountRef = useRef<HTMLInputElement>(null)
  const [direction, setDirection] = useState<MovementDirection>("expense")
  const [accountId, setAccountId] = useState(
    accounts.find((a) => a.id === defaultAccountId)?.id ?? accounts[0]?.id ?? ""
  )
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [personId, setPersonId] = useState("")
  const [date, setDate] = useState("")
  const [showDate, setShowDate] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [receiptKey, setReceiptKey] = useState(0)

  const { state, onSubmit, pending } = useFormAction(createLedgerEntryAction)

  // Tras guardar: queda lista para el siguiente (misma cuenta y tipo).
  useActionFeedback(state, () => {
    setAmount("")
    setDescription("")
    setCategoryId(null)
    setPersonId("")
    setDate("")
    setShowDate(false)
    setReceiptKey((key) => key + 1)
    amountRef.current?.focus()
  })

  const errors = state.fieldErrors ?? {}
  const account = accounts.find((a) => a.id === accountId)
  const allowedTypes = direction === "expense" ? EXPENSE_CATEGORY_TYPES : INCOME_CATEGORY_TYPES
  const directionCategories = categories.filter((c) => allowedTypes.includes(c.type))
  const quickCategories = directionCategories.slice(0, QUICK_CATEGORY_LIMIT)
  const selectedOutsideQuick =
    categoryId && !quickCategories.some((c) => c.id === categoryId)
      ? directionCategories.find((c) => c.id === categoryId)
      : undefined
  const visibleCategories = showAllCategories
    ? directionCategories
    : [...quickCategories, ...(selectedOutsideQuick ? [selectedOutsideQuick] : [])]
  const selectedCategory = categories.find((c) => c.id === categoryId)
  const needsPerson = Boolean(selectedCategory && PERSON_CATEGORY_TYPES.includes(selectedCategory.type))

  const parsedAmount = parseAmount(amount)
  const today = toCaracasDate()

  const changeDirection = (value: MovementDirection) => {
    setDirection(value)
    setCategoryId(null)
    setShowAllCategories(false)
  }

  if (accounts.length === 0) {
    return (
      <StatusAlert tone="warning" title="No hay cuentas activas">
        Pide a un owner o admin que cree las cuentas en Configuración → Cuentas.
      </StatusAlert>
    )
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 pb-24 md:pb-0" noValidate>
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="account_id" value={accountId} />
      <input type="hidden" name="category_id" value={categoryId ?? ""} />
      <input type="hidden" name="date" value={showDate ? date : ""} />
      {needsPerson && <input type="hidden" name="person_id" value={personId} />}

      {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}

      <div role="radiogroup" aria-label="Tipo de movimiento" className="grid grid-cols-2 gap-2">
        {DIRECTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={direction === value}
            onClick={() => changeDirection(value)}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-lg border text-base font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              direction === value
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-accent"
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <FormField label="Monto" htmlFor="entry-amount" error={errors.amount}>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-lg text-muted-foreground">
            {account ? CURRENCY_SYMBOLS[account.currency] : ""}
          </span>
          <Input
            ref={amountRef}
            id="entry-amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={Boolean(errors.amount)}
            className={cn("h-14 text-2xl font-semibold tabular-nums", account?.currency === "USDT" ? "pl-16" : "pl-11")}
          />
        </div>
        {parsedAmount !== null && account && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatMoney(parsedAmount, account.currency)}
            {rates && account.currency !== "USDT" && (
              <> · ≈ {formatUsdt(toUsdt(parsedAmount, account.currency, rates))}</>
            )}
          </p>
        )}
      </FormField>

      <FormField label="Cuenta" htmlFor="entry-account" error={errors.account_id}>
        <ChoiceChips
          id="entry-account"
          label="Cuenta"
          value={accountId}
          onChange={setAccountId}
          options={accounts.map((a) => ({ value: a.id, label: a.name, hint: a.currency }))}
        />
      </FormField>

      <FormField label="Categoría" htmlFor="entry-category" error={errors.category_id}>
        {directionCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay categorías de {direction === "expense" ? "gasto" : "ingreso"} disponibles.
          </p>
        ) : (
          <>
            <ChoiceChips
              id="entry-category"
              label="Categoría"
              value={categoryId}
              onChange={setCategoryId}
              options={visibleCategories.map((c) => ({ value: c.id, label: c.name }))}
            />
            {directionCategories.length > QUICK_CATEGORY_LIMIT && (
              <Button
                type="button"
                variant="link"
                className="h-auto justify-start px-0"
                onClick={() => setShowAllCategories((value) => !value)}
              >
                {showAllCategories ? "Ver menos" : `Ver todas (${directionCategories.length})`}
              </Button>
            )}
          </>
        )}
      </FormField>

      {needsPerson && (
        <FormField
          label="Persona"
          htmlFor="entry-person"
          error={errors.person_id}
          hint="Quién recibe el dinero (o quién lo aporta)."
        >
          <Select value={personId} onValueChange={setPersonId}>
            <SelectTrigger id="entry-person" className="h-11 w-full md:h-9">
              <SelectValue placeholder="Elige la persona" />
            </SelectTrigger>
            <SelectContent>
              {people.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}

      <FormField label="Descripción" htmlFor="entry-description" error={errors.description} optional>
        <Input
          id="entry-description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={direction === "expense" ? "¿En qué se gastó?" : "¿De dónde viene?"}
          className="h-11 md:h-9"
        />
      </FormField>

      {showDate ? (
        <FormField label="Fecha" htmlFor="entry-date" error={errors.date}>
          <Input
            id="entry-date"
            type="date"
            max={today}
            value={date || today}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 md:h-9"
          />
        </FormField>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className="h-auto justify-start px-0 text-muted-foreground"
          onClick={() => setShowDate(true)}
        >
          <CalendarIcon aria-hidden />
          Hoy · cambiar fecha
        </Button>
      )}

      <div className="grid gap-2">
        <ReceiptField key={receiptKey} enabled={receiptsEnabled} onUploadingChange={setUploading} />
        {errors.receipt_path && <StatusAlert tone="error" title={errors.receipt_path[0]} />}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <SubmitButton pending={pending} disabled={uploading} className="h-12 w-full text-base md:h-10">
          {direction === "expense" ? "Registrar gasto" : "Registrar ingreso"}
        </SubmitButton>
      </div>
    </form>
  )
}

export default LedgerEntryForm

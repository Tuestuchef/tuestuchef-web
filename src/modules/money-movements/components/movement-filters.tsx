"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Input } from "@/common/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/common/components/ui/select"

import type { AccountOption, MovementFilters as Filters } from "../lib/types/money-movements.types"

const ALL = "all"

const TYPE_OPTIONS = [
  { value: ALL, label: "Todos los tipos" },
  { value: "expense", label: "Gastos" },
  { value: "income", label: "Ingresos" },
  { value: "transfer", label: "Traspasos" },
] as const

type MovementFiltersProps = {
  filters: Filters
  accounts: AccountOption[]
}

// Los filtros viven en la URL: se pueden compartir y sobreviven al recargar.
const MovementFilters = ({ filters, accounts }: MovementFiltersProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams)
    if (!value || value === ALL) params.delete(key)
    else params.set(key, value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Input
        type="month"
        aria-label="Mes"
        value={filters.month}
        onChange={(e) => setParam("month", e.target.value)}
        className="h-11 md:h-9"
      />
      <Select value={filters.accountId ?? ALL} onValueChange={(value) => setParam("account", value)}>
        <SelectTrigger aria-label="Cuenta" className="h-11 w-full md:h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas las cuentas</SelectItem>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.direction ?? ALL} onValueChange={(value) => setParam("type", value)}>
        <SelectTrigger aria-label="Tipo" className="h-11 w-full md:h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default MovementFilters

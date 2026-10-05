"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { Input } from "@/common/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/common/components/ui/select"

import { QUOTE_STATUS_LABELS } from "../lib/constants/quotes.constants"
import type { QuoteFilters as Filters } from "../lib/schemas/quote.schema"
import type { QuoteStatus } from "../lib/types/quotes.types"

const ALL = "all"

// Los filtros viven en la URL: se pueden compartir y sobreviven al recargar.
const QuoteFilters = ({ filters }: { filters: Filters }) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(filters.q ?? "")

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams)
    if (!value || value === ALL) params.delete(key)
    else params.set(key, value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Input
        type="search"
        aria-label="Buscar por número o cliente"
        placeholder="Número o cliente"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && setParam("q", search.trim())}
        onBlur={() => search.trim() !== (filters.q ?? "") && setParam("q", search.trim())}
        className="h-11 md:h-9"
      />
      <Select value={filters.status ?? ALL} onValueChange={(value) => setParam("status", value)}>
        <SelectTrigger aria-label="Estado" className="h-11 w-full md:h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los estados</SelectItem>
          {(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).map((status) => (
            <SelectItem key={status} value={status}>
              {QUOTE_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input type="date" aria-label="Desde" value={filters.from ?? ""} onChange={(e) => setParam("from", e.target.value)} className="h-11 md:h-9" />
      <Input type="date" aria-label="Hasta" value={filters.to ?? ""} onChange={(e) => setParam("to", e.target.value)} className="h-11 md:h-9" />
    </div>
  )
}

export default QuoteFilters

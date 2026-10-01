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

import { PURCHASE_STATUS_LABELS, type PurchaseStatus } from "../lib/constants/purchases.constants"
import type { PurchaseFilters as Filters } from "../lib/types/purchases.types"

const ALL = "all"

// Filtros en la URL: se pueden compartir y sobreviven al recargar.
const PurchaseFilters = ({ filters, suppliers }: { filters: Filters; suppliers: { id: string; name: string }[] }) => {
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
      <Select value={filters.supplierId ?? ALL} onValueChange={(value) => setParam("supplier", value)}>
        <SelectTrigger aria-label="Proveedor" className="h-11 w-full md:h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los proveedores</SelectItem>
          {suppliers.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.status ?? ALL} onValueChange={(value) => setParam("status", value)}>
        <SelectTrigger aria-label="Estado de pago" className="h-11 w-full md:h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los estados</SelectItem>
          {(Object.keys(PURCHASE_STATUS_LABELS) as PurchaseStatus[]).map((status) => (
            <SelectItem key={status} value={status}>
              {PURCHASE_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default PurchaseFilters

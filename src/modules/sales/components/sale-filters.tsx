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

import { CHANNEL_LABELS, PAYMENT_STATUS_LABELS, type PaymentStatus, type SaleChannel } from "../lib/constants/sales.constants"
import type { SalesFilters } from "../lib/types/sales.types"

const ALL = "all"

// Los filtros viven en la URL: se pueden compartir y sobreviven al recargar.
const SaleFilters = ({ filters }: { filters: SalesFilters }) => {
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
      <Select value={filters.channel ?? ALL} onValueChange={(value) => setParam("channel", value)}>
        <SelectTrigger aria-label="Canal" className="h-11 w-full md:h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los canales</SelectItem>
          {(Object.keys(CHANNEL_LABELS) as SaleChannel[]).map((channel) => (
            <SelectItem key={channel} value={channel}>
              {CHANNEL_LABELS[channel]}
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
          {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((status) => (
            <SelectItem key={status} value={status}>
              {PAYMENT_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default SaleFilters

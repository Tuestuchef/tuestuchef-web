"use client"

import { usePathname, useRouter } from "next/navigation"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/common/components/ui/select"

import { PERIODS, type PeriodValue } from "../lib/constants/analytics.constants"

const PeriodSelect = ({ value }: { value: PeriodValue }) => {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <Select value={value} onValueChange={(next) => router.replace(`${pathname}?periodo=${next}`, { scroll: false })}>
      <SelectTrigger aria-label="Período" className="h-11 w-full sm:w-48 md:h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIODS.map((period) => (
          <SelectItem key={period.value} value={period.value}>
            {period.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default PeriodSelect

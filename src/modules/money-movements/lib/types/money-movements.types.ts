import type { Currency } from "@/common/lib/constants/currency.constants"
import type { Tables } from "@/common/lib/db/database.types"

import type {
  CategoryType,
  LedgerEntryType,
  MovementDirection,
} from "../constants/money-movements.constants"

export type MovementCategory = Tables<"movement_categories">

export type CategoryOption = {
  id: string
  name: string
  type: CategoryType
  uses: number
}

export type AccountOption = {
  id: string
  name: string
  currency: Currency
}

export type PersonOption = {
  id: string
  fullName: string
}

export type LedgerEntryItem = {
  id: string
  occurredAt: string
  entryType: LedgerEntryType
  amount: number
  currency: Currency
  usdtValue: number
  description: string | null
  hasReceipt: boolean
  accountName: string
  category: { name: string; type: CategoryType } | null
  personName: string | null
  authorName: string | null
  transferId: string | null
  reversesEntryId: string | null
  isReversed: boolean
}

export type MovementFilters = {
  month: string
  accountId?: string
  direction?: MovementDirection | "transfer"
}

export type MovementTotals = {
  incomeUsdt: number
  expenseUsdt: number
}

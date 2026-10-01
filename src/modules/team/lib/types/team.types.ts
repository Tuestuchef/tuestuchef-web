import type { Currency } from "@/common/lib/constants/currency.constants"
import type { Tables } from "@/common/lib/db/database.types"

import type { PayrollEntryKind, SalaryFrequency } from "../constants/team.constants"

export type TeamMember = Tables<"team_members">

export type Salary = { amount: number; currency: Currency; frequency: SalaryFrequency; effectiveFrom: string }

export type TeamMemberListItem = {
  id: string
  fullName: string
  jobTitle: string | null
  hasAccount: boolean
  isActive: boolean
  salary: Salary | null
  pendingAdvancesUsd: number
  paidThisMonthUsd: number
}

export type PayrollEntryItem = {
  id: string
  kind: PayrollEntryKind
  currency: Currency
  amount: number
  usdAmount: number
  periodLabel: string | null
  occurredAt: string
  accountName: string
  description: string | null
  isPendingAdvance: boolean
  isReversed: boolean
}

export type TeamMemberDetail = {
  member: TeamMember & { accountEmail: string | null }
  agreements: (Salary & { id: string; notes: string | null; createdAt: string })[]
  currentSalary: Salary | null
  entries: PayrollEntryItem[]
  pendingAdvances: PayrollEntryItem[]
}

export type LinkableProfile = { id: string; label: string }

import "server-only"

import type { Currency } from "@/common/lib/constants/currency.constants"
import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { caracasMonthRange, caracasNoonIso, toCaracasDate, toCaracasMonth } from "@/common/lib/utils/format-date.util"

import type { PayrollInput, SalaryAgreementInput, TeamMemberInput } from "../schemas/team.schema"
import type { LinkableProfile, PayrollEntryItem, Salary, TeamMemberDetail, TeamMemberListItem } from "../types/team.types"

// Todo lo de equipo es de owner y admin (RLS devuelve 0 filas a staff).

const toSalary = (a: { amount: number; currency: Currency; frequency: Salary["frequency"]; effective_from: string }): Salary => ({
  amount: Number(a.amount),
  currency: a.currency,
  frequency: a.frequency,
  effectiveFrom: a.effective_from,
})

export async function listTeam(): Promise<TeamMemberListItem[]> {
  const supabase = await createSupabaseServerClient()
  const { from, to } = caracasMonthRange(toCaracasMonth())
  const [members, salaries, pending, paid] = await Promise.all([
    supabase.from("team_members").select("id, full_name, job_title, profile_id, is_active").order("is_active", { ascending: false }).order("full_name"),
    supabase.from("current_salary_agreements").select("team_member_id, amount, currency, frequency, effective_from"),
    supabase.from("pending_salary_advances").select("team_member_id, usd_amount"),
    supabase.from("payroll_entries").select("team_member_id, usd_amount").gte("occurred_at", from).lt("occurred_at", to),
  ])
  if (members.error) throw members.error

  const sum = (rows: { team_member_id: string | null; usd_amount: number | null }[] | null) => {
    const totals = new Map<string, number>()
    for (const r of rows ?? []) if (r.team_member_id) totals.set(r.team_member_id, (totals.get(r.team_member_id) ?? 0) + Number(r.usd_amount ?? 0))
    return totals
  }
  const pendingBy = sum(pending.data)
  const paidBy = sum(paid.data)
  const salaryBy = new Map((salaries.data ?? []).map((s) => [s.team_member_id, s]))

  return members.data.map((m) => {
    const salary = salaryBy.get(m.id)
    return {
      id: m.id,
      fullName: m.full_name,
      jobTitle: m.job_title,
      hasAccount: Boolean(m.profile_id),
      isActive: m.is_active,
      salary: salary ? toSalary(salary as Parameters<typeof toSalary>[0]) : null,
      pendingAdvancesUsd: pendingBy.get(m.id) ?? 0,
      paidThisMonthUsd: paidBy.get(m.id) ?? 0,
    }
  })
}

export async function getTeamMember(id: string): Promise<TeamMemberDetail | null> {
  const supabase = await createSupabaseServerClient()
  const { data: member, error } = await supabase
    .from("team_members")
    .select("*, profile:profiles!team_members_profile_id_fkey(email)")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  if (!member) return null

  const [agreements, current, entries, pending] = await Promise.all([
    supabase.from("salary_agreements").select("*").eq("team_member_id", id).order("effective_from", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("current_salary_agreements").select("amount, currency, frequency, effective_from").eq("team_member_id", id).maybeSingle(),
    supabase
      .from("payroll_entries")
      .select("id, kind, currency, amount, usd_amount, period_label, occurred_at, ledger:ledger_entries(id, description, account:accounts(name))")
      .eq("team_member_id", id)
      .order("occurred_at", { ascending: false })
      .limit(100),
    supabase.from("pending_salary_advances").select("id").eq("team_member_id", id),
  ])
  if (entries.error) throw entries.error

  const ledgerIds = entries.data.map((e) => e.ledger?.id).filter((v): v is string => Boolean(v))
  const { data: reversals } = ledgerIds.length
    ? await supabase.from("ledger_entries").select("reverses_entry_id").in("reverses_entry_id", ledgerIds)
    : { data: [] as { reverses_entry_id: string | null }[] }
  const reversed = new Set((reversals ?? []).map((r) => r.reverses_entry_id))
  const pendingIds = new Set((pending.data ?? []).map((p) => p.id))

  const items: PayrollEntryItem[] = entries.data.map((e) => ({
    id: e.id,
    kind: e.kind,
    currency: e.currency,
    amount: Number(e.amount),
    usdAmount: Number(e.usd_amount),
    periodLabel: e.period_label,
    occurredAt: e.occurred_at,
    accountName: e.ledger?.account?.name ?? "—",
    description: e.ledger?.description ?? null,
    isPendingAdvance: pendingIds.has(e.id),
    isReversed: reversed.has(e.ledger?.id ?? ""),
  }))

  const { profile, ...rest } = member
  return {
    member: { ...rest, accountEmail: profile?.email ?? null },
    agreements: (agreements.data ?? []).map((a) => ({ ...toSalary(a), id: a.id, notes: a.notes, createdAt: a.created_at })),
    currentSalary: current.data ? toSalary(current.data as Parameters<typeof toSalary>[0]) : null,
    entries: items,
    pendingAdvances: items.filter((i) => i.isPendingAdvance),
  }
}

// Usuarios del sistema que aún no están vinculados a una persona del equipo.
export async function listLinkableProfiles(currentProfileId?: string | null): Promise<LinkableProfile[]> {
  const supabase = await createSupabaseServerClient()
  const [profiles, linked] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
    supabase.from("team_members").select("profile_id").not("profile_id", "is", null),
  ])
  if (profiles.error) throw profiles.error
  const taken = new Set((linked.data ?? []).map((l) => l.profile_id))
  return profiles.data
    .filter((p) => !taken.has(p.id) || p.id === currentProfileId)
    .map((p) => ({ id: p.id, label: [p.full_name, p.email].filter(Boolean).join(" · ") }))
}

export async function saveTeamMember(input: TeamMemberInput) {
  const supabase = await createSupabaseServerClient()
  const values = {
    full_name: input.full_name,
    profile_id: input.profile_id ?? null,
    job_title: input.job_title ?? null,
    phone: input.phone,
    notes: input.notes ?? null,
    is_active: input.is_active,
  }
  return input.id
    ? supabase.from("team_members").update(values).eq("id", input.id).select("id").single()
    : supabase.from("team_members").insert(values).select("id").single()
}

export async function addSalaryAgreement(input: SalaryAgreementInput) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("salary_agreements").insert({
    team_member_id: input.team_member_id,
    amount: input.amount,
    currency: input.currency,
    frequency: input.frequency,
    effective_from: input.effective_from,
    notes: input.notes ?? null,
  })
}

export async function registerPayroll(input: PayrollInput) {
  const supabase = await createSupabaseServerClient()
  const occurredAt = input.date && input.date !== toCaracasDate() ? caracasNoonIso(input.date) : undefined
  if (input.kind === "advance") {
    return supabase.rpc("register_salary_advance", {
      p_team_member_id: input.team_member_id,
      p_account_id: input.account_id,
      p_amount: input.amount,
      p_note: input.note,
      p_occurred_at: occurredAt,
      p_receipt_path: input.receipt_path,
    })
  }
  return supabase.rpc("register_salary_payment", {
    p_team_member_id: input.team_member_id,
    p_account_id: input.account_id,
    p_amount: input.amount,
    p_period_label: input.period_label,
    p_settle_advance_ids: input.settle_advance_ids,
    p_note: input.note,
    p_occurred_at: occurredAt,
    p_receipt_path: input.receipt_path,
  })
}

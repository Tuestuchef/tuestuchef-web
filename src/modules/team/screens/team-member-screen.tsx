import { ChevronLeftIcon } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { Button } from "@/common/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/common/components/ui/card"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { isStorageEnabled } from "@/common/lib/services/storage.service"
import { formatDate } from "@/common/lib/utils/format-date.util"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { listAccounts } from "@/modules/treasury/lib/services/accounts.service"
import { getRateStatus } from "@/modules/treasury/lib/services/exchange-rates.service"

import PayrollDialog from "../components/payroll-dialog"
import SalaryAgreementDialog from "../components/salary-agreement-dialog"
import TeamMemberFormDialog from "../components/team-member-form-dialog"
import { FREQUENCY_LABELS, PAYROLL_KIND_LABELS } from "../lib/constants/team.constants"
import { getTeamMember, listLinkableProfiles } from "../lib/services/team.service"

const TeamMemberScreen = async ({ id }: { id: string }) => {
  const [detail, accounts, rateStatus] = await Promise.all([getTeamMember(id), listAccounts({ activeOnly: true }), getRateStatus()])
  if (!detail) notFound()
  const profiles = await listLinkableProfiles(detail.member.profile_id)
  const { member, currentSalary, agreements, entries, pendingAdvances } = detail
  const rates = rateStatus.rate ? { bcvUsd: Number(rateStatus.rate.bcv_usd), usdUsdt: Number(rateStatus.rate.usd_usdt) } : null
  const accountOptions = accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))
  const payrollProps = {
    memberId: member.id,
    memberName: member.full_name,
    accounts: accountOptions,
    rates,
    today: rateStatus.today,
    salary: currentSalary,
    pendingAdvances,
    receiptsEnabled: isStorageEnabled(),
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <Button asChild variant="ghost" className="h-auto w-fit px-0 text-muted-foreground">
        <Link href={ROUTES.TEAM}>
          <ChevronLeftIcon aria-hidden />
          Equipo
        </Link>
      </Button>
      <PageHeader
        className="pt-0"
        help="teamMember"
        title={member.full_name}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            {member.job_title ?? "Sin puesto"}
            {member.accountEmail ? ` · cuenta ${member.accountEmail}` : <StatusBadge tone="info">Sin cuenta</StatusBadge>}
            {!member.is_active && <StatusBadge tone="info">Inactiva</StatusBadge>}
          </span>
        }
        actions={<TeamMemberFormDialog member={member} profiles={profiles} />}
      />

      <div className="flex flex-wrap gap-2">
        {member.is_active && accountOptions.length > 0 && (
          <>
            <PayrollDialog kind="payment" {...payrollProps} />
            <PayrollDialog kind="advance" {...payrollProps} />
          </>
        )}
        <SalaryAgreementDialog memberId={member.id} current={currentSalary} today={rateStatus.today} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sueldo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {currentSalary ? (
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(currentSalary.amount, currentSalary.currency)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {FREQUENCY_LABELS[currentSalary.frequency].toLowerCase()} · desde {formatDate(`${currentSalary.effectiveFrom}T12:00:00-04:00`)}
              </span>
            </p>
          ) : (
            <p className="text-muted-foreground">Sin sueldo definido.</p>
          )}
          {agreements.length > 1 && (
            <details>
              <summary className="cursor-pointer text-muted-foreground">Historial ({agreements.length})</summary>
              <ul className="mt-2 grid gap-1">
                {agreements.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3 tabular-nums">
                    <span>
                      Desde {formatDate(`${a.effectiveFrom}T12:00:00-04:00`)}
                      {a.notes && <span className="text-muted-foreground"> · {a.notes}</span>}
                    </span>
                    <span>
                      {formatMoney(a.amount, a.currency)} {FREQUENCY_LABELS[a.frequency].toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagos y adelantos</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay pagos.</p>
          ) : (
            <ul className="divide-y">
              {entries.map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-2.5">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      {PAYROLL_KIND_LABELS[e.kind]}
                      {e.isPendingAdvance && <StatusBadge tone="warning">Por descontar</StatusBadge>}
                      {e.isReversed && <StatusBadge tone="error">Revertido</StatusBadge>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(e.occurredAt)} · {e.accountName}
                      {e.periodLabel && ` · ${e.periodLabel}`}
                    </span>
                  </div>
                  <span className="grid justify-items-end text-sm tabular-nums">
                    {formatMoney(e.amount, e.currency)}
                    {e.currency !== "USD" && <span className="text-xs text-muted-foreground">≈ {formatMoney(e.usdAmount, "USD")}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default TeamMemberScreen

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
import PieceworkPaymentDialog from "@/modules/orders/components/piecework-payment-dialog"
import { listPendingPiecework } from "@/modules/orders/lib/services/production.service"
import { ITEM_STATUS_LABELS } from "@/modules/sales/lib/constants/sales.constants"
import { listAccounts } from "@/modules/treasury/lib/services/accounts.service"
import { getRateStatus } from "@/modules/treasury/lib/services/exchange-rates.service"

import PayrollDialog from "../components/payroll-dialog"
import SalaryAgreementDialog from "../components/salary-agreement-dialog"
import TeamMemberFormDialog from "../components/team-member-form-dialog"
import { FREQUENCY_LABELS, PAYROLL_KIND_LABELS } from "../lib/constants/team.constants"
import { getTeamMember, listLinkableProfiles } from "../lib/services/team.service"
import { formatSalary } from "../lib/utils/salary.util"

const TeamMemberScreen = async ({ id }: { id: string }) => {
  const [detail, accounts, rateStatus] = await Promise.all([getTeamMember(id), listAccounts({ activeOnly: true }), getRateStatus()])
  if (!detail) notFound()
  const [profiles, piecework] = await Promise.all([
    listLinkableProfiles(detail.member.profile_id),
    detail.member.pay_basis === "salary" ? Promise.resolve([]) : listPendingPiecework(id),
  ])
  const { member, currentSalary, agreements, entries, pendingAdvances } = detail
  const rates = rateStatus.rate ? { bcvUsd: Number(rateStatus.rate.bcv_usd), bcvEur: Number(rateStatus.rate.bcv_eur), usdUsdt: Number(rateStatus.rate.usd_usdt) } : null
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
        {member.is_active && (
          <PieceworkPaymentDialog
            memberId={member.id}
            pieces={piecework}
            advances={pendingAdvances.map((a) => ({ id: a.id, usdAmount: a.usdAmount, occurredAt: a.occurredAt }))}
            accounts={accountOptions}
          />
        )}
      </div>

      {member.pay_basis !== "salary" && (
        <Card>
          <CardHeader>
            <CardTitle>Destajo pendiente</CardTitle>
          </CardHeader>
          <CardContent>
            {piecework.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin piezas por pagar.</p>
            ) : (
              <ul className="divide-y text-sm">
                {piecework.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2">
                    <span className="grid flex-1">
                      <span>{p.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {ITEM_STATUS_LABELS[p.stage]} · {p.pieces} piezas · {formatDate(p.completedAt)}
                      </span>
                    </span>
                    <span className="tabular-nums">{formatMoney(p.amountUsd, "USD")}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sueldo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {currentSalary ? (
            <p className="text-lg font-semibold tabular-nums">
              {formatSalary(currentSalary)}{" "}
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
                      {formatSalary(a)} {FREQUENCY_LABELS[a.frequency].toLowerCase()}
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

import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"

import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { Card, CardContent } from "@/common/components/ui/card"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatMoney } from "@/common/lib/utils/format-money.util"

import TeamMemberFormDialog from "../components/team-member-form-dialog"
import { FREQUENCY_LABELS } from "../lib/constants/team.constants"
import { listLinkableProfiles, listTeam } from "../lib/services/team.service"

const usd = (value: number) => formatMoney(value, "USD")

// Equipo (owner y admin): quién cobra, cuánto, lo pagado este mes y adelantos pendientes.
const TeamScreen = async () => {
  const [team, profiles] = await Promise.all([listTeam(), listLinkableProfiles()])
  const paidMonth = team.reduce((sum, m) => sum + m.paidThisMonthUsd, 0)
  const pending = team.reduce((sum, m) => sum + m.pendingAdvancesUsd, 0)

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader
        help="team"
        title="Equipo"
        description="Sueldos, pagos y adelantos. Solo owner y admin."
        actions={<TeamMemberFormDialog profiles={profiles} />}
      />

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 tabular-nums">
          <div className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">Pagado este mes (USD ref.)</span>
            <span className="text-lg font-semibold">{usd(paidMonth)}</span>
          </div>
          <div className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">Adelantos por descontar</span>
            <span className="text-lg font-semibold">{usd(pending)}</span>
          </div>
        </CardContent>
      </Card>

      {team.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay personas en el equipo.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {team.map((m) => (
            <li key={m.id}>
              <Link
                href={ROUTES.TEAM_MEMBER(m.id)}
                className="flex items-center gap-3 p-3 transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5 font-medium">
                    {m.fullName}
                    {!m.hasAccount && <StatusBadge tone="info">Sin cuenta</StatusBadge>}
                    {!m.isActive && <StatusBadge tone="info">Inactiva</StatusBadge>}
                    {m.pendingAdvancesUsd > 0 && <StatusBadge tone="warning">Adelanto {usd(m.pendingAdvancesUsd)}</StatusBadge>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {[
                      m.jobTitle,
                      m.salary
                        ? `${formatMoney(m.salary.amount, m.salary.currency)} ${FREQUENCY_LABELS[m.salary.frequency].toLowerCase()}`
                        : "Sin sueldo definido",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <span className="text-right text-sm tabular-nums">
                  <span className="block text-xs text-muted-foreground">Este mes</span>
                  {usd(m.paidThisMonthUsd)}
                </span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default TeamScreen

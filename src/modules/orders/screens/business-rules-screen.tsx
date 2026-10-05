import { BotIcon, UsersRoundIcon } from "lucide-react"

import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { formatDate } from "@/common/lib/utils/format-date.util"

import BusinessRuleDialog from "../components/business-rule-dialog"
import { listBusinessRules } from "../lib/services/business-rules.service"

// Reglas del negocio: todos las leen; owner y admin las escriben.
const BusinessRulesScreen = async ({ canManage }: { canManage: boolean }) => {
  const rules = (await listBusinessRules()).filter((r) => canManage || r.isActive)

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader
        help="businessRules"
        title="Reglas del negocio"
        description="Cómo trabajamos. Las marcadas como “del sistema” se cumplen solas."
        actions={canManage && <BusinessRuleDialog />}
      />
      {rules.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Todavía no hay reglas escritas.</p>
      ) : (
        <ol className="grid gap-3">
          {rules.map((rule) => (
            <li key={rule.id} className="grid gap-2 rounded-xl border p-4">
              <div className="flex items-start gap-2">
                <h2 className="flex-1 font-medium">{rule.title}</h2>
                {canManage && <BusinessRuleDialog rule={rule} />}
              </div>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{rule.body}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {rule.enforcedBySystem ? (
                  <StatusBadge tone="success">
                    <BotIcon aria-hidden />
                    La aplica el sistema
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="info">
                    <UsersRoundIcon aria-hidden />
                    La aplica el equipo
                  </StatusBadge>
                )}
                {!rule.isActive && <StatusBadge tone="warning">No vigente</StatusBadge>}
                <span>Actualizada el {formatDate(rule.updatedAt)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default BusinessRulesScreen

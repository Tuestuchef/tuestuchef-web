import { ROLE_LABELS } from "@/common/lib/constants/roles.constants"
import { formatDate, formatTime } from "@/common/lib/utils/format-date.util"

import type { RoleChange } from "../lib/types/users.types"

const describe = (change: RoleChange) => {
  const parts: string[] = []
  if (change.previousRole !== change.newRole) {
    parts.push(`${ROLE_LABELS[change.previousRole]} → ${ROLE_LABELS[change.newRole]}`)
  }
  if (change.previousIsActive !== change.newIsActive) {
    parts.push(change.newIsActive ? "Activado" : "Desactivado")
  }
  return parts.join(" · ")
}

const RoleChangeList = ({ changes }: { changes: RoleChange[] }) =>
  changes.length === 0 ? (
    <p className="text-sm text-muted-foreground">Aún no hay cambios de rol.</p>
  ) : (
    <ul className="divide-y text-sm">
      {changes.map((change) => (
        <li key={change.id} className="grid gap-0.5 py-2">
          <span>
            <span className="font-medium">{change.profileName}</span>: {describe(change)}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(change.changedAt)} {formatTime(change.changedAt)} · por {change.changedByName ?? "el sistema"}
          </span>
        </li>
      ))}
    </ul>
  )

export default RoleChangeList

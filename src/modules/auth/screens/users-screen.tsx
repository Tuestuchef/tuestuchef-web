import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/common/components/ui/card"
import { ROLE_LABELS } from "@/common/lib/constants/roles.constants"
import type { SessionUser } from "@/common/lib/types/session.types"

import InviteUserDialog from "../components/invite-user-dialog"
import RoleChangeList from "../components/role-change-list"
import UserRowActions from "../components/user-row-actions"
import { isInviteEnabled, listRoleChanges, listTeamMembers } from "../lib/services/users.service"
import { allowedActions, assignableRoles } from "../lib/utils/user-permissions.util"

type UsersScreenProps = {
  user: SessionUser
}

const UsersScreen = async ({ user }: UsersScreenProps) => {
  const [members, changes] = await Promise.all([listTeamMembers(), listRoleChanges()])
  const roles = assignableRoles(user.role)

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader
        help="users"
        title="Usuarios"
        description="Roles fijos: owner ve todo, admin gestiona, staff registra. Los usuarios no se borran: se desactivan."
        actions={<InviteUserDialog roles={roles} enabled={isInviteEnabled()} />}
      />

      <Card>
        <CardContent>
          <ul className="divide-y">
            {members.map((member) => {
              const actions = allowedActions(user, member)
              return (
                <li key={member.id} className="flex items-center gap-3 py-3">
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate font-medium">
                      {member.fullName || member.email}
                      {member.id === user.id && <span className="font-normal text-muted-foreground"> (tú)</span>}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {member.email}
                      {member.invitedByName ? ` · invitado por ${member.invitedByName}` : ""}
                    </span>
                  </div>
                  <span className="text-sm">{ROLE_LABELS[member.role]}</span>
                  {!member.isActive && <StatusBadge tone="warning">Inactivo</StatusBadge>}
                  <UserRowActions
                    member={member}
                    roles={roles}
                    canChangeRole={actions.changeRole}
                    canToggleActive={actions.toggleActive}
                  />
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de cambios</CardTitle>
        </CardHeader>
        <CardContent>
          <RoleChangeList changes={changes} />
        </CardContent>
      </Card>
    </div>
  )
}

export default UsersScreen

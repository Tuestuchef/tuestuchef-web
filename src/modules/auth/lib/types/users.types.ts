import type { AppRole } from "@/common/lib/constants/roles.constants"

export type TeamMember = {
  id: string
  fullName: string
  email: string | null
  role: AppRole
  isActive: boolean
  createdAt: string
  invitedByName: string | null
}

export type RoleChange = {
  id: string
  changedAt: string
  profileName: string
  changedByName: string | null
  previousRole: AppRole
  newRole: AppRole
  previousIsActive: boolean
  newIsActive: boolean
}

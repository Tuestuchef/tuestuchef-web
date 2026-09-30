import type { Enums } from "@/common/lib/db/database.types"

export type AppRole = Enums<"app_role">

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Dueño",
  admin: "Administrador",
  staff: "Equipo",
}

// Grupos de permisos. Las reglas reales viven en RLS; esto solo ordena la interfaz.
export const ROLE_GROUPS = {
  ALL: ["owner", "admin", "staff"],
  MANAGEMENT: ["owner", "admin"],
  OWNER: ["owner"],
} as const satisfies Record<string, readonly AppRole[]>

export const isRoleIn = (role: AppRole, group: readonly AppRole[]) => group.includes(role)

import "server-only"

import { publicEnv } from "@/common/lib/config/env.config"
import type { AppRole } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { createSupabaseAdminClient } from "@/common/lib/db/supabase-admin.client"
import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { USER_MESSAGES } from "../constants/users.constants"
import type { InviteUserInput } from "../schemas/users.schema"
import type { RoleChange, TeamMember } from "../types/users.types"

type Result = { ok: true } | { ok: false; error: string }

export const isInviteEnabled = () => createSupabaseAdminClient() !== null

// RLS: owner y admin ven a todos.
export async function listTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active, created_at, invited_by")
    .order("is_active", { ascending: false })
    .order("full_name")

  if (error) throw error
  const names = new Map(data.map((row) => [row.id, row.full_name || row.email]))
  return data.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    invitedByName: row.invited_by ? (names.get(row.invited_by) ?? null) : null,
  }))
}

export async function getTeamMember(id: string) {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.from("profiles").select("id, role, is_active").eq("id", id).maybeSingle()
  return data ? { id: data.id, role: data.role, isActive: data.is_active } : null
}

export async function listRoleChanges(limit = 20): Promise<RoleChange[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("role_changes")
    .select(
      `id, changed_at, previous_role, new_role, previous_is_active, new_is_active,
       profile:profiles!role_changes_profile_id_fkey(full_name, email),
       author:profiles!role_changes_changed_by_fkey(full_name)`
    )
    .order("changed_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  return data.map((row) => ({
    id: row.id,
    changedAt: row.changed_at,
    profileName: row.profile?.full_name || row.profile?.email || "—",
    changedByName: row.author?.full_name ?? null,
    previousRole: row.previous_role,
    newRole: row.new_role,
    previousIsActive: row.previous_is_active,
    newIsActive: row.new_is_active,
  }))
}

// Invita con Supabase Auth. El perfil nace como staff (trigger); si el rol pedido es
// otro, se asigna con la sesión de quien invita, así RLS vuelve a validar el permiso
// y el cambio queda en role_changes con su autor.
export async function inviteUser(input: InviteUserInput, inviterId: string): Promise<Result> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { ok: false, error: USER_MESSAGES.INVITES_DISABLED }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.full_name },
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}${ROUTES.AUTH_CONFIRM}`,
  })

  if (error || !data.user) {
    const exists = error?.code === "email_exists" || /already.*registered/i.test(error?.message ?? "")
    return { ok: false, error: exists ? USER_MESSAGES.ALREADY_EXISTS : USER_MESSAGES.INVITE_FAILED }
  }

  await admin.from("profiles").update({ invited_by: inviterId }).eq("id", data.user.id)

  if (input.role !== "staff") {
    const result = await changeUserRole(data.user.id, input.role)
    if (!result.ok) return result
  }

  return { ok: true }
}

// Con la sesión del usuario: RLS decide si puede (0 filas = sin permiso).
export async function changeUserRole(profileId: string, role: AppRole): Promise<Result> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from("profiles").update({ role }).eq("id", profileId).select("id")
  if (error) return { ok: false, error: toUserError(error) }
  if (!data.length) return { ok: false, error: USER_MESSAGES.NOT_FOUND }
  return { ok: true }
}

export async function setUserActive(profileId: string, isActive: boolean): Promise<Result> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", profileId)
    .select("id")
  if (error) return { ok: false, error: toUserError(error) }
  if (!data.length) return { ok: false, error: USER_MESSAGES.NOT_FOUND }
  return { ok: true }
}

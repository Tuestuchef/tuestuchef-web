import type { AppRole } from "@/common/lib/constants/roles.constants"

export type SessionUser = {
  id: string
  email: string
  fullName: string
  role: AppRole
  // Menú simple (solo lo de todos los días) o completo.
  simpleMode: boolean
}

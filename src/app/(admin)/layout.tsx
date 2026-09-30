import AdminShell from "@/common/components/admin-shell/admin-shell"
import { requireSessionUser } from "@/common/lib/services/session.service"

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const user = await requireSessionUser()

  return <AdminShell user={user}>{children}</AdminShell>
}

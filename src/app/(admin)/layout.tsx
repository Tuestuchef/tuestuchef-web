import AdminShell from "@/common/components/admin-shell/admin-shell"
import { requireSessionUser } from "@/common/lib/services/session.service"
import OfflineSync from "@/modules/sales/components/offline-sync"

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const user = await requireSessionUser()

  return (
    <AdminShell user={user}>
      <OfflineSync />
      {children}
    </AdminShell>
  )
}

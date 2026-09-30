import { cookies } from "next/headers"

import AdminShellHeader from "@/common/components/admin-shell/admin-shell-header"
import AdminShellSidebar from "@/common/components/admin-shell/admin-shell-sidebar"
import { SidebarInset, SidebarProvider } from "@/common/components/ui/sidebar"
import type { SessionUser } from "@/common/lib/types/session.types"

type AdminShellProps = {
  user: SessionUser
  children: React.ReactNode
}

// Marco del panel: sidebar-07 (colapsa a iconos, hoja en el celular) con el contenedor
// "inset" de dashboard-01 (contenido en una tarjeta redondeada sobre el fondo del sidebar).
const AdminShell = async ({ user, children }: AdminShellProps) => {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={{ "--header-height": "calc(var(--spacing) * 12)" } as React.CSSProperties}
    >
      <AdminShellSidebar user={user} />
      <SidebarInset>
        <AdminShellHeader />
        <main className="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default AdminShell

import Link from "next/link"

import AdminShellNav from "@/common/components/admin-shell/admin-shell-nav"
import AdminShellUser from "@/common/components/admin-shell/admin-shell-user"
import Logo from "@/common/components/logo/logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/common/components/ui/sidebar"
import { brandConfig } from "@/common/lib/config/brand.config"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import type { SessionUser } from "@/common/lib/types/session.types"

type AdminShellSidebarProps = {
  user: SessionUser
}

const AdminShellSidebar = ({ user }: AdminShellSidebarProps) => {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip={brandConfig.name}>
              <Link href={ROUTES.HOME}>
                {/* El sidebar es negro en ambos modos: letras blancas. Colapsado, solo el ícono. */}
                <Logo variant="gradient" className="size-8 shrink-0" priority />
                {/* El botón fuerza a 16px todos sus <svg> ([&_svg]:size-4): las letras lo anulan con "!". */}
                <span className="flex min-w-0 group-data-[collapsible=icon]:hidden">
                  <Logo variant="lettering" color="white" decorative className="h-2! w-auto!" />
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <AdminShellNav role={user.role} />
      </SidebarContent>
      <SidebarFooter>
        <AdminShellUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export default AdminShellSidebar

import Link from "next/link"

import AdminShellNav from "@/common/components/admin-shell/admin-shell-nav"
import AdminShellUser from "@/common/components/admin-shell/admin-shell-user"
import BrandLogo from "@/common/components/brand-logo"
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
                <BrandLogo className="min-w-0" />
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

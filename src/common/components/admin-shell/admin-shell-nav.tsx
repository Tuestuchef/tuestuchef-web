"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/common/components/ui/sidebar"
import { NAV_GROUPS } from "@/common/lib/constants/navigation.constants"
import type { AppRole } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

type AdminShellNavProps = {
  role: AppRole
}

const isActivePath = (pathname: string, url: string) =>
  url === ROUTES.HOME ? pathname === url : pathname === url || pathname.startsWith(`${url}/`)

const AdminShellNav = ({ role }: AdminShellNavProps) => {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0)

  return groups.map((group) => (
    <SidebarGroup key={group.label}>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarMenu>
        {group.items.map(({ title, url, icon: Icon, soon }) => (
          <SidebarMenuItem key={url}>
            {soon ? (
              <SidebarMenuButton
                disabled
                aria-disabled
                tooltip={`${title} (pronto)`}
                className="h-10 md:h-8"
              >
                <Icon />
                <span>{title}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  Pronto
                </span>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                asChild
                isActive={isActivePath(pathname, url)}
                tooltip={title}
                className="h-10 md:h-8"
              >
                <Link
                  href={url}
                  onClick={() => isMobile && setOpenMobile(false)}
                >
                  <Icon />
                  <span>{title}</span>
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  ))
}

export default AdminShellNav

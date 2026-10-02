"use client"

import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/common/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/common/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/common/components/ui/sidebar"
import { NAV_ITEMS, type NavItem, type NavLink } from "@/common/lib/constants/navigation.constants"
import type { AppRole } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

type AdminShellNavProps = {
  role: AppRole
}

const matches = (pathname: string, url: string) =>
  url === ROUTES.HOME ? pathname === url : pathname === url || pathname.startsWith(`${url}/`)

// El enlace activo es el más específico (p. ej. /ventas/nueva gana a /ventas).
const activeUrl = (pathname: string, links: readonly NavLink[]) =>
  links
    .filter((link) => matches(pathname, link.url))
    .sort((a, b) => b.url.length - a.url.length)[0]?.url

const AdminShellNav = ({ role }: AdminShellNavProps) => {
  const pathname = usePathname()
  const { isMobile, setOpenMobile, state } = useSidebar()
  const collapsed = state === "collapsed" && !isMobile
  const closeMobile = () => isMobile && setOpenMobile(false)

  // Solo lo que el rol puede ver; un grupo sin hijos visibles desaparece.
  const items = NAV_ITEMS.flatMap((item): NavItem[] => {
    if (!item.roles.includes(role)) return []
    if (!item.children) return [item]
    const children = item.children.filter((child) => child.roles.includes(role))
    if (children.length === 0) return []
    // Un solo enlace visible: va directo, sin submenú (p. ej. Tesorería → Movimientos para staff).
    if (children.length === 1) return [{ ...children[0], icon: item.icon }]
    return [{ ...item, children }]
  })
  const current = activeUrl(pathname, items.flatMap((item) => item.children ?? [item]))

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          const Icon = item.icon

          if (!item.children) {
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={current === item.url} tooltip={item.title} className="h-10 md:h-8">
                  <Link href={item.url} onClick={closeMobile}>
                    <Icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          const groupActive = item.children.some((child) => child.url === current)

          // Barra colapsada a íconos: el submenú se abre al costado.
          if (collapsed) {
            return (
              <SidebarMenuItem key={item.title}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton isActive={groupActive} tooltip={item.title} className="h-8">
                      <Icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="min-w-48">
                    <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
                    {item.children.map((child) => (
                      <DropdownMenuItem key={child.url} asChild>
                        <Link href={child.url} aria-current={child.url === current ? "page" : undefined}>
                          {child.title}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            )
          }

          return (
            <Collapsible key={item.title} asChild defaultOpen={groupActive} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton isActive={groupActive && !isMobile} tooltip={item.title} className="h-10 md:h-8">
                    <Icon />
                    <span>{item.title}</span>
                    <ChevronRightIcon
                      className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                      aria-hidden
                    />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.children.map((child) => (
                      <SidebarMenuSubItem key={child.url}>
                        <SidebarMenuSubButton asChild isActive={child.url === current} className="h-9 md:h-7">
                          <Link href={child.url} onClick={closeMobile}>
                            <span>{child.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

export default AdminShellNav

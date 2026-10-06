"use client"

import { ChevronRightIcon, TriangleAlertIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import AdminShellQuickCreate from "@/common/components/admin-shell/admin-shell-quick-create"
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
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/common/components/ui/sidebar"
import {
  MISSING_RATE_LABEL,
  NAV_BADGE_LABELS,
  NAV_SECTIONS,
  type NavBadgeKey,
  type NavItem,
  type NavLink,
  type NavSection,
} from "@/common/lib/constants/navigation.constants"
import type { AppRole } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { cn } from "@/common/lib/utils"
import { type NavBadgeValues, useNavBadges } from "@/common/lib/hooks/use-nav-badges.hook"

type AdminShellNavProps = {
  role: AppRole
}

const matches = (pathname: string, url: string) =>
  url === ROUTES.HOME ? pathname === url : pathname === url || pathname.startsWith(`${url}/`)

// El enlace activo es el más específico (p. ej. /ventas/por-cobrar gana a /ventas).
const activeUrl = (pathname: string, links: readonly NavLink[]) =>
  links
    .filter((link) => matches(pathname, link.url))
    .sort((a, b) => b.url.length - a.url.length)[0]?.url

// Solo lo que el rol puede ver; un submenú con un solo hijo va directo y un área vacía desaparece.
const visibleSections = (role: AppRole): NavSection[] =>
  NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.flatMap((item): NavItem[] => {
      if (!item.roles.includes(role)) return []
      if (!item.children) return [item]
      const children = item.children.filter((child) => child.roles.includes(role))
      if (children.length === 0) return []
      if (children.length === 1) return [{ ...children[0], icon: item.icon }]
      return [{ ...item, children }]
    }),
  })).filter((section) => section.items.length > 0)

// Contador (o aviso) al lado del enlace. Con la barra colapsada a íconos, un punto sobre el ícono.
const NavBadge = ({ badge, values }: { badge: NavBadgeKey; values: NavBadgeValues }) => {
  const value = values[badge]
  if (!value) return null

  const label =
    badge === "missingTodayRate" ? MISSING_RATE_LABEL : `${value} ${NAV_BADGE_LABELS[badge][value === 1 ? "one" : "other"]}`
  return (
    <>
      {/* Centrado: los botones son más altos en el celular que en la computadora. */}
      {/* Blanco sobre el sidebar negro (como Registrar venta); el rojo es solo del dinero. El "!" evita
          que el hover o el enlace activo le cambien el color al texto. */}
      <SidebarMenuBadge
        title={label}
        className="top-1/2! -translate-y-1/2 rounded-full bg-sidebar-primary px-1.5 font-semibold text-sidebar-primary-foreground!"
      >
        {badge === "missingTodayRate" ? (
          <TriangleAlertIcon className="size-4" aria-hidden />
        ) : (
          <span aria-hidden>{Number(value) > 99 ? "99+" : value}</span>
        )}
        <span className="sr-only">{label}</span>
      </SidebarMenuBadge>
      <span
        aria-hidden
        className="pointer-events-none absolute top-1 right-1 hidden size-2 rounded-full bg-sidebar-primary ring-2 ring-sidebar group-data-[collapsible=icon]:block"
      />
    </>
  )
}

const AdminShellNav = ({ role }: AdminShellNavProps) => {
  const badges = useNavBadges({ watchNavigation: true })
  const pathname = usePathname()
  const { isMobile, setOpenMobile, state } = useSidebar()
  const collapsed = state === "collapsed" && !isMobile
  const closeMobile = () => isMobile && setOpenMobile(false)

  const sections = visibleSections(role)
  const current = activeUrl(
    pathname,
    sections.flatMap((section) => section.items.flatMap((item) => item.children ?? [item]))
  )

  const renderItem = (item: NavItem) => {
    const Icon = item.icon

    if (!item.children) {
      return (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton asChild isActive={current === item.url} tooltip={item.title} className={cn("h-10 md:h-8", item.badge && "pr-9")}>
            <Link href={item.url} onClick={closeMobile}>
              <Icon />
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
          {item.badge && <NavBadge badge={item.badge} values={badges} />}
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
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <AdminShellQuickCreate role={role} />
        </SidebarGroupContent>
      </SidebarGroup>
      {sections.map((section, index) => (
        <SidebarGroup key={section.label ?? index}>
          {section.label && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{section.items.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}

export default AdminShellNav

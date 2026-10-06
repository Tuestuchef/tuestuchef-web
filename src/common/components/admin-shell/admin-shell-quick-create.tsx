"use client"

import { ChevronDownIcon, CirclePlusIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@/common/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/common/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/common/components/ui/sidebar"
import { QUICK_ACTIONS } from "@/common/lib/constants/navigation.constants"
import type { AppRole } from "@/common/lib/constants/roles.constants"

// Registro rápido: el botón principal abre la acción más usada (venta) en un toque;
// el botón de al lado muestra todo lo que el rol puede registrar.
const AdminShellQuickCreate = ({ role }: { role: AppRole }) => {
  const { isMobile, setOpenMobile } = useSidebar()
  const actions = QUICK_ACTIONS.filter((action) => action.roles.includes(role))
  const [primary] = actions
  const closeMobile = () => isMobile && setOpenMobile(false)

  if (!primary) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex items-center gap-2">
        <SidebarMenuButton
          asChild
          tooltip={`Registrar ${primary.title.toLowerCase()}`}
          className="h-10 min-w-8 bg-sidebar-primary text-sidebar-primary-foreground duration-200 ease-linear hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground active:bg-sidebar-primary/90 active:text-sidebar-primary-foreground md:h-8"
        >
          <Link href={primary.url} onClick={closeMobile}>
            <CirclePlusIcon />
            <span>Registrar {primary.title.toLowerCase()}</span>
          </Link>
        </SidebarMenuButton>
        {actions.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                // Sobre el sidebar negro en ambos modos: colores del sidebar también al abrirse y en modo oscuro.
                className="size-10 shrink-0 border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground dark:border-sidebar-border dark:bg-sidebar dark:hover:bg-sidebar-accent group-data-[collapsible=icon]:hidden md:size-8"
                aria-label="Registrar otra cosa"
              >
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side={isMobile ? "bottom" : "right"} className="min-w-60">
              <DropdownMenuLabel>Registrar</DropdownMenuLabel>
              {actions.map((action) => {
                const Icon = action.icon
                return (
                  <DropdownMenuItem key={action.url} asChild className="py-2">
                    <Link href={action.url} onClick={closeMobile}>
                      <Icon aria-hidden />
                      <span className="grid">
                        <span className="font-medium">{action.title}</span>
                        <span className="text-xs text-muted-foreground">{action.description}</span>
                      </span>
                    </Link>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export default AdminShellQuickCreate

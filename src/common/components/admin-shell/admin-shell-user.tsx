"use client"

import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react"

import ThemeToggle from "@/common/components/theme-toggle"
import { Avatar, AvatarFallback } from "@/common/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/common/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/common/components/ui/sidebar"
import { ROLE_LABELS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import type { SessionUser } from "@/common/lib/types/session.types"
import { getInitials } from "@/common/lib/utils/get-initials.util"

type AdminShellUserProps = {
  user: SessionUser
}

const AdminShellUser = ({ user }: AdminShellUserProps) => {
  const { isMobile } = useSidebar()
  const displayName = user.fullName || user.email
  const initials = getInitials(displayName)

  const identity = (
    <>
      <Avatar className="size-8 rounded-lg">
        <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{displayName}</span>
        {/* Se usa en el sidebar (negro) y en el menú (claro): hereda el color de cada uno. */}
        <span className="truncate text-xs text-current/70">
          {ROLE_LABELS[user.role]}
        </span>
      </div>
    </>
  )

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {identity}
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "top" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5">
                {identity}
              </div>
              <p className="truncate px-1 pb-1.5 text-xs text-muted-foreground">
                {user.email}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ThemeToggle />
            <DropdownMenuSeparator />
            <form
              action={ROUTES.SIGN_OUT}
              method="post"
              // Las páginas guardadas para usar sin señal son de esta sesión: se borran al salir.
              onSubmit={() => navigator.serviceWorker?.controller?.postMessage({ type: "clear-pages" })}
            >
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOutIcon />
                  Cerrar sesión
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export default AdminShellUser

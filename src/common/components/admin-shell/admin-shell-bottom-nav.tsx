"use client"

import {
  ClipboardListIcon,
  EllipsisIcon,
  FileTextIcon,
  HouseIcon,
  LayoutListIcon,
  LogOutIcon,
  type LucideIcon,
  PlusIcon,
  ShoppingBagIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/common/components/ui/sheet"
import { type NavBadgeKey, NAV_SECTIONS } from "@/common/lib/constants/navigation.constants"
import { ROLE_LABELS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { useNavBadges } from "@/common/lib/hooks/use-nav-badges.hook"
import type { SessionUser } from "@/common/lib/types/session.types"
import { cn } from "@/common/lib/utils"
import { setSimpleModeAction } from "@/modules/auth/lib/actions/ui-mode.action"

type Tab = { title: string; url: string; icon: LucideIcon; badge?: NavBadgeKey }

// Las pestañas fijas; lo demás del modo simple va en "Más".
const TABS: Tab[] = [
  { title: "Inicio", url: ROUTES.HOME, icon: HouseIcon },
  { title: "Ventas", url: ROUTES.SALES, icon: ShoppingBagIcon },
  { title: "Pedidos", url: ROUTES.ORDERS, icon: ClipboardListIcon, badge: "openOrders" },
]

// Lo que se registra desde el botón central (tocar = venta; mantener presionado = elegir).
const CREATE_OPTIONS = [
  { title: "Venta", url: ROUTES.NEW_SALE, icon: ShoppingBagIcon },
  { title: "Pedido", url: ROUTES.NEW_ORDER, icon: ClipboardListIcon },
  { title: "Presupuesto", url: ROUTES.NEW_QUOTE, icon: FileTextIcon },
]

const isActive = (pathname: string, url: string) =>
  url === ROUTES.HOME ? pathname === url : pathname === url || pathname.startsWith(`${url}/`)

const BadgeDot = ({ value }: { value: number | boolean | undefined }) =>
  value ? (
    <span className="absolute -top-1 left-1/2 ml-1.5 min-w-4 rounded-full bg-foreground px-1 text-center text-[10px] leading-4 font-semibold text-background">
      {typeof value === "number" ? (value > 99 ? "99+" : value) : "!"}
    </span>
  ) : null

// Modo simple en el celular: pestañas abajo, como una app (en la computadora sigue el menú lateral corto).
const AdminShellBottomNav = ({ user }: { user: SessionUser }) => {
  const pathname = usePathname()
  const router = useRouter()
  const badges = useNavBadges()
  const [moreOpen, setMoreOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)

  // "Más": el resto de lo que el modo simple muestra para este rol (sin las pestañas fijas).
  const tabUrls = new Set(TABS.map((t) => t.url))
  const more = NAV_SECTIONS.flatMap((section) => section.items).filter(
    (item) => item.simple && item.roles.includes(user.role) && !tabUrls.has(item.url)
  )

  const startPress = () => {
    longPressed.current = false
    pressTimer.current = setTimeout(() => {
      longPressed.current = true
      setCreateOpen(true)
    }, 450)
  }
  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
  }

  const toFullMode = () =>
    startTransition(async () => {
      const result = await setSimpleModeAction(false)
      if (!result.ok) toast.error(result.error)
      else setMoreOpen(false)
    })

  const tab = (item: Tab) => {
    const active = isActive(pathname, item.url)
    return (
      <Link
        key={item.url}
        href={item.url}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px]",
          active ? "font-semibold text-foreground" : "text-muted-foreground"
        )}
      >
        <span className="relative">
          <item.icon className="size-5" aria-hidden />
          {item.badge && <BadgeDot value={badges[item.badge]} />}
        </span>
        {item.title}
      </Link>
    )
  }

  return (
    <>
      <nav
        aria-label="Navegación"
        className="fixed inset-x-0 bottom-0 z-30 flex h-(--bottom-nav-h) items-stretch border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden"
      >
        {tab(TABS[0])}
        {tab(TABS[1])}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            aria-label="Registrar venta (mantén presionado para pedido o presupuesto)"
            className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background select-none"
            onPointerDown={startPress}
            onPointerUp={endPress}
            onPointerLeave={endPress}
            onContextMenu={(event) => event.preventDefault()}
            onClick={() => {
              if (!longPressed.current) router.push(ROUTES.NEW_SALE)
            }}
          >
            <PlusIcon className="size-7" aria-hidden />
          </button>
        </div>
        {tab(TABS[2])}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px]",
            more.some((m) => isActive(pathname, m.url)) ? "font-semibold text-foreground" : "text-muted-foreground"
          )}
        >
          <span className="relative">
            <EllipsisIcon className="size-5" aria-hidden />
            <BadgeDot value={more.some((m) => m.badge && badges[m.badge]) || undefined} />
          </span>
          Más
        </button>
      </nav>

      {/* Mantener presionado el botón central: qué registrar. */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="bottom" className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Registrar</SheetTitle>
            <SheetDescription>Tocar el botón + abre directo una venta.</SheetDescription>
          </SheetHeader>
          <ul className="grid gap-1 px-4">
            {CREATE_OPTIONS.map((option) => (
              <li key={option.url}>
                <Link
                  href={option.url}
                  onClick={() => setCreateOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-base hover:bg-accent"
                >
                  <option.icon className="size-5" aria-hidden />
                  {option.title}
                </Link>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>

      {/* Más: el resto del modo simple, la cuenta y volver al modo completo. */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>{user.fullName || user.email}</SheetTitle>
            <SheetDescription>{ROLE_LABELS[user.role]}</SheetDescription>
          </SheetHeader>
          <ul className="grid grid-cols-3 gap-2 px-4">
            {more.map((item) => {
              const value = item.badge ? badges[item.badge] : undefined
              return (
                <li key={item.url}>
                  <Link
                    href={item.url}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs",
                      isActive(pathname, item.url) && "border-foreground font-semibold"
                    )}
                  >
                    <span className="relative">
                      <item.icon className="size-5" aria-hidden />
                      <BadgeDot value={value} />
                    </span>
                    {item.title}
                  </Link>
                </li>
              )
            })}
          </ul>
          <div className="grid gap-1 border-t px-4 pt-3">
            <button
              type="button"
              disabled={pending}
              onClick={toFullMode}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-accent"
            >
              <LayoutListIcon className="size-5" aria-hidden />
              <span>
                Cambiar a modo completo
                <span className="block text-xs text-muted-foreground">Todo el menú: compras, tesorería, producción…</span>
              </span>
            </button>
            <form
              action={ROUTES.SIGN_OUT}
              method="post"
              onSubmit={() => navigator.serviceWorker?.controller?.postMessage({ type: "clear-pages" })}
            >
              <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-accent">
                <LogOutIcon className="size-5" aria-hidden />
                Cerrar sesión
              </button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

export default AdminShellBottomNav

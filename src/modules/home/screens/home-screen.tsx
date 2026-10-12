import { PlusIcon, ShoppingBagIcon, TruckIcon } from "lucide-react"
import Link from "next/link"

import PageHelp from "@/common/components/page-help"
import { Button } from "@/common/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/common/components/ui/card"
import { NAV_LINKS } from "@/common/lib/constants/navigation.constants"
import { ROLE_LABELS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import type { SessionUser } from "@/common/lib/types/session.types"
import { caracasNoonIso, formatDate, toCaracasDate } from "@/common/lib/utils/format-date.util"
import { formatSaleNumber } from "@/modules/sales/lib/constants/sales.constants"
import { listPendingShipments } from "@/modules/sales/lib/services/sales.service"
import RateSummary from "@/modules/treasury/components/rate-summary"
import TodayRateBanner from "@/modules/treasury/components/today-rate-banner"
import { getRateStatus } from "@/modules/treasury/lib/services/exchange-rates.service"

type HomeScreenProps = {
  user: SessionUser
}

const HomeScreen = async ({ user }: HomeScreenProps) => {
  const [rateStatus, shipments] = await Promise.all([getRateStatus(), listPendingShipments()])
  const today = toCaracasDate()
  const firstName = user.fullName.split(" ")[0] || user.email
  const upcoming = NAV_LINKS.filter((item) => item.soon && item.roles.includes(user.role))

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div className="grid gap-1 pt-2">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Hola, {firstName}</h1>
          <PageHelp topic="home" />
        </div>
        <p className="text-sm text-muted-foreground">Rol: {ROLE_LABELS[user.role]}</p>
      </div>

      {rateStatus.hasTodayRate ? (
        <RateSummary rate={rateStatus.rate} hasTodayRate className="text-muted-foreground" />
      ) : (
        <TodayRateBanner />
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild className="h-14 text-base">
          <Link href={ROUTES.NEW_SALE}>
            <ShoppingBagIcon aria-hidden />
            Registrar venta
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-14 text-base">
          <Link href={ROUTES.NEW_MOVEMENT}>
            <PlusIcon aria-hidden />
            Registrar gasto o ingreso
          </Link>
        </Button>
      </div>

      {shipments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TruckIcon className="size-4" aria-hidden />
              Por enviar
            </CardTitle>
            <CardDescription>Ventas con fecha de envío de hoy o ya pasada que aún no se entregan.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {shipments.map((s) => (
                <li key={s.id}>
                  <Link href={ROUTES.SALE(s.id)} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:underline">
                    <span>
                      {formatSaleNumber(s.number)} · {s.customerName ?? "Venta rápida"}
                    </span>
                    <span className={s.shipDate < today ? "font-medium" : "text-muted-foreground"}>
                      {s.shipDate < today ? `Atrasado (${formatDate(caracasNoonIso(s.shipDate))})` : "Hoy"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Próximamente</CardTitle>
            <CardDescription>Estos módulos se activan en el menú a medida que estén listos.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {upcoming.map(({ title, icon: Icon }) => (
                <li key={title} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                  <span className="font-medium">{title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">Pronto</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default HomeScreen

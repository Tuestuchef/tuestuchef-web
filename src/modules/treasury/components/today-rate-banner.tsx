"use client"

import { useState } from "react"

import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"
import { Card, CardContent } from "@/common/components/ui/card"

import ExchangeRateForm from "./exchange-rate-form"

// Aviso cuando falta la tasa de hoy. Cualquier rol puede registrarla si aún no existe.
const TodayRateBanner = () => {
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <CardContent className="grid gap-4">
        <StatusAlert tone="warning" title="Falta la tasa de hoy">
          Los movimientos usan la última tasa registrada. Registra la de hoy para que el valor real
          en USDT sea correcto.
        </StatusAlert>
        {open ? (
          <ExchangeRateForm onSuccess={() => setOpen(false)} />
        ) : (
          <Button type="button" className="h-11 md:h-9" onClick={() => setOpen(true)}>
            Registrar tasa de hoy
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default TodayRateBanner

"use client"

import { BellOffIcon, BellRingIcon, Loader2Icon } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"

import { subscribePushAction, unsubscribePushAction } from "../lib/actions/notifications.action"

type DeviceState = "loading" | "unsupported" | "denied" | "off" | "on"

// Base64url → bytes (la clave VAPID pública).
const keyBytes = (base64: string) => {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

// Activar o desactivar los avisos push en este dispositivo. En iPhone hace falta instalar el panel
// en la pantalla de inicio (Compartir → Agregar a inicio).
const PushDeviceToggle = ({ vapidPublicKey }: { vapidPublicKey: string | null }) => {
  const [state, setState] = useState<DeviceState>("loading")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const check = async () => {
      if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState("unsupported")
        return
      }
      if (Notification.permission === "denied") {
        setState("denied")
        return
      }
      const registration = await navigator.serviceWorker.register("/sw.js")
      const subscription = await registration.pushManager.getSubscription()
      setState(subscription ? "on" : "off")
    }
    void check()
  }, [vapidPublicKey])

  const enable = () =>
    startTransition(async () => {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off")
        return
      }
      const registration = await navigator.serviceWorker.register("/sw.js")
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(vapidPublicKey!),
      })
      const result = await subscribePushAction({ ...subscription.toJSON(), userAgent: navigator.userAgent })
      if (result.ok) {
        toast.success(result.message)
        setState("on")
      } else {
        await subscription.unsubscribe()
        toast.error(result.error)
      }
    })

  const disable = () =>
    startTransition(async () => {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js")
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await unsubscribePushAction(subscription.endpoint)
        await subscription.unsubscribe()
      }
      toast.success("Avisos desactivados en este dispositivo.")
      setState("off")
    })

  if (state === "loading") return <Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-label="Revisando" />
  if (state === "unsupported") {
    return (
      <StatusAlert tone="info" title="Este dispositivo no recibe avisos push">
        {vapidPublicKey
          ? "En iPhone, instala el panel en la pantalla de inicio (Compartir → Agregar a inicio) y ábrelo desde ahí."
          : "El push todavía no está configurado en el servidor."}
      </StatusAlert>
    )
  }
  if (state === "denied") {
    return (
      <StatusAlert tone="warning" title="Los avisos están bloqueados en este navegador">
        Permítelos en la configuración del sitio y vuelve a intentar.
      </StatusAlert>
    )
  }
  return state === "on" ? (
    <Button variant="outline" className="h-11 md:h-9" disabled={pending} onClick={disable}>
      <BellOffIcon aria-hidden />
      Desactivar en este dispositivo
    </Button>
  ) : (
    <Button className="h-11 md:h-9" disabled={pending} onClick={enable}>
      <BellRingIcon aria-hidden />
      Activar avisos en este dispositivo
    </Button>
  )
}

export default PushDeviceToggle

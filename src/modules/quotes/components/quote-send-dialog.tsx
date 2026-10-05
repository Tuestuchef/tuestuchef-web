"use client"

import { Loader2Icon, MailIcon, MessageCircleIcon, SendIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import ChoiceChips from "@/common/components/choice-chips"
import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/common/components/ui/dialog"
import { Input } from "@/common/components/ui/input"
import { Textarea } from "@/common/components/ui/textarea"

import { deliverQuoteAction } from "../lib/actions/quotes.action"

type Channel = "email" | "whatsapp" | "none"

type QuoteSendDialogProps = {
  id: string
  code: string
  // Primer envío (borrador) o reenvío de uno ya enviado.
  mode: "send" | "resend"
  defaultEmail: string | null
  defaultPhone: string | null
  emailConfigured: boolean
}

// Enviar o reenviar un presupuesto por correo (PDF adjunto) o WhatsApp (texto con el enlace).
// En un borrador, enviarlo lo congela y guarda su PDF oficial.
const QuoteSendDialog = ({ id, code, mode, defaultEmail, defaultPhone, emailConfigured }: QuoteSendDialogProps) => {
  const [open, setOpen] = useState(false)
  const [channel, setChannel] = useState<Channel>(emailConfigured && defaultEmail ? "email" : "whatsapp")
  const [email, setEmail] = useState(defaultEmail ?? "")
  const [phone, setPhone] = useState(defaultPhone ?? "")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const options = [
    { value: "email", label: "Correo", hint: emailConfigured ? undefined : "no configurado" },
    { value: "whatsapp", label: "WhatsApp" },
    ...(mode === "send" ? [{ value: "none", label: "Solo marcar como enviado" }] : []),
  ]

  const send = () => {
    setError(null)
    // WhatsApp se abre al tocar (si no, el navegador bloquea la ventana) y recibe el enlace al tenerlo.
    const win = channel === "whatsapp" ? window.open("", "_blank") : null
    startTransition(async () => {
      const result = await deliverQuoteAction({ id, channel, email, phone, note })
      if (!result.ok) {
        win?.close()
        setError(result.error)
        return
      }
      if (result.url) {
        if (win) win.location.href = result.url
        else window.location.href = result.url
      } else win?.close()
      toast.success(result.message)
      setOpen(false)
    })
  }

  const blocked = channel === "email" && (!emailConfigured || !email.trim())

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={mode === "send" ? "default" : "outline"} className="h-11 md:h-9">
          <SendIcon aria-hidden />
          {mode === "send" ? "Enviar" : "Reenviar"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "send" ? "Enviar" : "Reenviar"} {code}
          </DialogTitle>
          <DialogDescription>
            {mode === "send"
              ? "Al enviarlo queda congelado: para cambiarlo después habrá que crear una versión nueva."
              : "Se envía el mismo PDF que recibió el cliente."}
          </DialogDescription>
        </DialogHeader>

        <ChoiceChips label="Cómo enviarlo" options={options} value={channel} onChange={(v) => setChannel(v as Channel)} />

        {channel === "email" &&
          (emailConfigured ? (
            <div className="grid gap-3">
              <FormField label="Correo del cliente" htmlFor="qs-email">
                <Input id="qs-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 md:h-9" />
              </FormField>
              <FormField label="Mensaje" htmlFor="qs-note" optional hint="Va en el correo, antes del enlace. El PDF va adjunto.">
                <Textarea id="qs-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Gracias por tu interés…" />
              </FormField>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MailIcon className="size-3.5" aria-hidden />
                Las respuestas le llegan a quien preparó el presupuesto.
              </p>
            </div>
          ) : (
            <StatusAlert tone="info" title="El correo no está configurado">
              Falta configurar Resend en el servidor. Mientras tanto, envíalo por WhatsApp.
            </StatusAlert>
          ))}

        {channel === "whatsapp" && (
          <div className="grid gap-3">
            <FormField label="WhatsApp del cliente" htmlFor="qs-phone" optional hint="Vacío: WhatsApp te deja elegir el contacto.">
              <Input id="qs-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0414-123.45.67" className="h-11 md:h-9" />
            </FormField>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageCircleIcon className="size-3.5" aria-hidden />
              Se abre WhatsApp con el mensaje y el enlace al PDF; toca enviar allá.
            </p>
          </div>
        )}

        {error && <StatusAlert tone="error" title={error} />}
        <DialogFooter>
          <Button className="h-11 md:h-9" disabled={pending || blocked} onClick={send}>
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            {channel === "email" ? "Enviar correo" : channel === "whatsapp" ? "Abrir WhatsApp" : "Marcar como enviado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default QuoteSendDialog

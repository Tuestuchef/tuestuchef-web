"use client"

import { ChevronDownIcon, Loader2Icon, MessageCircleIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/common/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/common/components/ui/dropdown-menu"
import { Textarea } from "@/common/components/ui/textarea"

import { prepareMessageAction, sendMessageAction } from "../lib/actions/messages.action"
import type { MessageKind, MessageTarget } from "../lib/types/messages.types"

type Option = { kind: MessageKind; label: string }

// Botón de WhatsApp: elige el mensaje, lo revisa (y ajusta) y abre WhatsApp con el texto.
const MessageButton = ({ target, options, size = "default" }: { target: MessageTarget; options: Option[]; size?: "default" | "sm" }) => {
  const [current, setCurrent] = useState<Option | null>(null)
  const [body, setBody] = useState("")
  const [hasPhone, setHasPhone] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, startLoading] = useTransition()
  const [sending, startSending] = useTransition()

  const open = (option: Option) => {
    setCurrent(option)
    setBody("")
    setError(null)
    startLoading(async () => {
      const result = await prepareMessageAction({ kind: option.kind, target })
      if (result.ok) {
        setBody(result.body)
        setHasPhone(result.hasPhone)
      } else setError(result.error)
    })
  }

  const send = () => {
    if (!current) return
    // La ventana se abre al tocar (si no, el navegador la bloquea) y se le pone el enlace al tenerlo.
    const win = window.open("", "_blank")
    startSending(async () => {
      const result = await sendMessageAction({ kind: current.kind, target, body })
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
      setCurrent(null)
    })
  }

  const buttonClass = size === "sm" ? undefined : "h-11 md:h-9"

  return (
    <>
      {options.length === 1 ? (
        <Button variant="outline" size={size} className={buttonClass} onClick={() => open(options[0])}>
          <MessageCircleIcon aria-hidden />
          WhatsApp
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size={size} className={buttonClass}>
              <MessageCircleIcon aria-hidden />
              WhatsApp
              <ChevronDownIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {options.map((option) => (
              <DropdownMenuItem key={option.kind} className="min-h-10 md:min-h-8" onSelect={() => open(option)}>
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={current !== null} onOpenChange={(value) => !value && setCurrent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{current?.label}</DialogTitle>
            <DialogDescription>Revisa el texto; puedes ajustarlo solo para este envío. Al abrir WhatsApp, toca enviar allá.</DialogDescription>
          </DialogHeader>
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
              Preparando el mensaje…
            </div>
          ) : (
            body && <Textarea aria-label="Mensaje" rows={10} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-sm" />
          )}
          {!loading && body && !hasPhone && (
            <StatusAlert tone="info" title="Sin teléfono">El cliente no tiene teléfono guardado: WhatsApp te deja elegir el contacto.</StatusAlert>
          )}
          {error && <StatusAlert tone="error" title={error} />}
          <DialogFooter>
            <Button className="h-11 md:h-9" disabled={loading || sending || !body.trim()} onClick={send}>
              {sending ? <Loader2Icon className="animate-spin" aria-hidden /> : <MessageCircleIcon aria-hidden />}
              Abrir WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default MessageButton

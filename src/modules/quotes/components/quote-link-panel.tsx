"use client"

import { CopyIcon, LinkIcon, UnlinkIcon } from "lucide-react"
import { useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/common/components/ui/button"

import { revokeQuoteLinkAction } from "../lib/actions/quotes.action"

type QuoteLinkPanelProps = {
  id: string
  link: string | null
  revoked: boolean
  views: { count: number; lastAtLabel: string | null }
}

// Enlace para que el cliente vea el PDF sin descargar nada: copiarlo, cortarlo y cuántas veces se abrió.
const QuoteLinkPanel = ({ id, link, revoked, views }: QuoteLinkPanelProps) => {
  const [pending, startTransition] = useTransition()
  return (
    <div className="grid gap-2 rounded-lg border p-3 text-sm">
      <span className="flex items-center gap-1.5 font-medium">
        <LinkIcon className="size-4" aria-hidden />
        Enlace para el cliente
      </span>
      {revoked ? (
        <p className="text-muted-foreground">Revocado: ya no abre el presupuesto. Para compartirlo de nuevo, crea una versión nueva.</p>
      ) : link ? (
        <>
          <p className="truncate font-mono text-xs text-muted-foreground">{link}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link)
                  toast.success("Enlace copiado.")
                } catch {
                  toast.error("No se pudo copiar el enlace.")
                }
              }}
            >
              <CopyIcon aria-hidden />
              Copiar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await revokeQuoteLinkAction(id)
                  if (result.ok) toast.success(result.message)
                  else toast.error(result.error)
                })
              }
            >
              <UnlinkIcon aria-hidden />
              Revocar
            </Button>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">No disponible: el enlace necesita el almacenamiento (R2) configurado.</p>
      )}
      <p className="text-xs text-muted-foreground">
        {views.count === 0
          ? "El cliente todavía no lo ha abierto."
          : `Abierto ${views.count} ${views.count === 1 ? "vez" : "veces"}${views.lastAtLabel ? ` · la última, ${views.lastAtLabel}` : ""}.`}
      </p>
    </div>
  )
}

export default QuoteLinkPanel

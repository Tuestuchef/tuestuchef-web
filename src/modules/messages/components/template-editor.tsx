"use client"

import { useId, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import StatusAlert from "@/common/components/status-alert"
import StatusBadge from "@/common/components/status-badge"
import { Button } from "@/common/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import { Input } from "@/common/components/ui/input"
import { Label } from "@/common/components/ui/label"
import { Switch } from "@/common/components/ui/switch"
import { Textarea } from "@/common/components/ui/textarea"
import { formatDate } from "@/common/lib/utils/format-date.util"

import { updateMessageTemplateAction } from "../lib/actions/messages.action"
import { MESSAGE_BODY_MAX, MESSAGE_KIND_DESCRIPTIONS, MESSAGE_PLACEHOLDERS } from "../lib/constants/messages.constants"
import type { MessageTemplate } from "../lib/types/messages.types"
import { renderTemplate, sampleValues, unknownPlaceholders } from "../lib/utils/render-template.util"

// Una plantilla: nombre, texto con datos entre llaves (se insertan tocando el dato) y vista previa.
const TemplateEditor = ({ template }: { template: MessageTemplate }) => {
  const id = useId()
  const textarea = useRef<HTMLTextAreaElement>(null)
  const [name, setName] = useState(template.name)
  const [body, setBody] = useState(template.body)
  const [enabled, setEnabled] = useState(template.enabled)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const unknown = unknownPlaceholders(template.kind, body)
  const dirty = name !== template.name || body !== template.body || enabled !== template.enabled

  const insert = (key: string) => {
    const el = textarea.current
    const token = `{${key}}`
    const start = el?.selectionStart ?? body.length
    const end = el?.selectionEnd ?? body.length
    setBody(body.slice(0, start) + token + body.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const save = () =>
    startTransition(async () => {
      const result = await updateMessageTemplateAction({ kind: template.kind, name, body, enabled })
      if (result.ok) {
        setError(null)
        toast.success(result.message)
      } else setError(result.error)
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{template.name}</CardTitle>
        <CardDescription>{MESSAGE_KIND_DESCRIPTIONS[template.kind]}</CardDescription>
        <CardAction>
          <StatusBadge tone={enabled ? "success" : "info"}>{enabled ? "Prendido" : "Apagado"}</StatusBadge>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="grid gap-0.5">
            <Label htmlFor={`${id}-enabled`}>Prendido</Label>
            <p className="text-xs text-muted-foreground">Apagado, no aparece en el botón de WhatsApp.</p>
          </div>
          <Switch id={`${id}-enabled`} checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-name`}>Nombre en el menú</Label>
          <Input id={`${id}-name`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="h-11 md:h-9" />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-body`}>Mensaje</Label>
          <Textarea
            id={`${id}-body`}
            ref={textarea}
            rows={8}
            maxLength={MESSAGE_BODY_MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">Toca un dato para agregarlo. *texto* = negrita y _texto_ = cursiva en WhatsApp.</p>
          <div className="flex flex-wrap gap-1.5">
            {MESSAGE_PLACEHOLDERS[template.kind].map((p) => (
              <Button key={p.key} type="button" size="sm" variant="secondary" onClick={() => insert(p.key)} title={p.label}>
                {`{${p.key}}`}
              </Button>
            ))}
          </div>
        </div>

        {unknown.length > 0 && (
          <StatusAlert tone="warning" title="Datos que este mensaje no conoce">
            {unknown.map((k) => `{${k}}`).join(", ")}. Corrígelos o quítalos.
          </StatusAlert>
        )}

        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Vista previa (con datos de ejemplo)</span>
          <p className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{renderTemplate(body, sampleValues(template.kind))}</p>
        </div>

        {error && <StatusAlert tone="error" title={error} />}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            Último cambio: {formatDate(template.updatedAt)}
            {template.updatedByName ? ` · ${template.updatedByName}` : ""}
          </span>
          <Button className="h-11 md:h-9" disabled={!dirty || pending || unknown.length > 0} onClick={save}>
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default TemplateEditor

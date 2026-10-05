"use client"

import { useState } from "react"

import ChoiceChips from "@/common/components/choice-chips"
import FormField from "@/common/components/form-field"
import ReceiptField from "@/common/components/receipt-field"
import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/common/components/ui/dialog"
import { Input } from "@/common/components/ui/input"
import { Textarea } from "@/common/components/ui/textarea"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"

import type { CustomizationType } from "../lib/types/orders.types"

export type LineCustomization = {
  key: string
  typeId: string
  quantity: number
  text?: string
  names?: string[]
  logoPath?: string
  position?: string
  sizeCm?: number
  note?: string
}

type CustomizationDialogProps = {
  open: boolean
  lineLabel: string
  lineQuantity: number
  types: CustomizationType[]
  storageEnabled: boolean
  // En un presupuesto, los nombres y el logo se piden después, en el pedido.
  mode?: "order" | "quote"
  onClose: () => void
  onSave: (customization: LineCustomization) => void
}

// Agregar una personalización a una línea: tipo, piezas, texto o nombres, logo y medida.
const CustomizationDialog = ({ open, lineLabel, lineQuantity, types, storageEnabled, mode = "order", onClose, onSave }: CustomizationDialogProps) => {
  const isQuote = mode === "quote"
  const usable = types.filter((t) => t.unitPriceUsd !== null)
  const [typeId, setTypeId] = useState(usable[0]?.id ?? "")
  const [quantity, setQuantity] = useState(String(lineQuantity))
  const [text, setText] = useState("")
  const [names, setNames] = useState("")
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [position, setPosition] = useState("")
  const [size, setSize] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)

  const type = usable.find((t) => t.id === typeId)
  const nameList = names
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean)

  const reset = () => {
    setQuantity(String(lineQuantity))
    setText("")
    setNames("")
    setLogoPath(null)
    setPosition("")
    setSize("")
    setNote("")
    setError(null)
  }

  const save = () => {
    if (!type) return
    const qty = Number(quantity)
    const sizeCm = size ? (parseAmount(size, 1) ?? undefined) : undefined
    const problem =
      !Number.isInteger(qty) || qty < 1 || qty > lineQuantity
        ? `Las piezas van de 1 a ${lineQuantity}.`
        : !isQuote && type.requiresText && !text.trim() && nameList.length === 0
          ? "Escribe el texto o la lista de nombres."
          : nameList.length > 0 && nameList.length !== qty
            ? `Van ${nameList.length} nombres para ${qty} piezas.`
            : !isQuote && type.requiresLogo && !logoPath
              ? "Sube el archivo del logo."
              : type.maxSizeCm !== null && sizeCm !== undefined && sizeCm > type.maxSizeCm
                ? `"${type.name}" es de hasta ${type.maxSizeCm} cm: más grande es logo de pecho.`
                : null
    if (problem) {
      setError(problem)
      return
    }
    onSave({
      key: crypto.randomUUID(),
      typeId: type.id,
      quantity: qty,
      text: text.trim() || undefined,
      names: nameList.length ? nameList : undefined,
      logoPath: logoPath ?? undefined,
      position: position.trim() || undefined,
      sizeCm,
      note: note.trim() || undefined,
    })
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personalizar</DialogTitle>
          <DialogDescription>{lineLabel}</DialogDescription>
        </DialogHeader>

        {usable.length === 0 ? (
          <StatusAlert tone="warning" title="No hay personalizaciones con precio">
            Owner o admin debe cargar los precios en Configuración → Pedidos y personalización.
          </StatusAlert>
        ) : (
          <div className="grid gap-4">
            <FormField label="Tipo" htmlFor="cz-type">
              <ChoiceChips
                id="cz-type"
                label="Tipo de personalización"
                value={typeId}
                onChange={setTypeId}
                options={usable.map((t) => ({ value: t.id, label: t.name }))}
              />
            </FormField>
            {type && (
              <p className="text-xs text-muted-foreground">
                {formatMoney(type.unitPriceUsd ?? 0, "USD")} c/u · desde {type.minQuantity} {type.minQuantity === 1 ? "pieza" : "piezas"} por pedido
                {type.maxSizeCm !== null && ` · hasta ${type.maxSizeCm} cm`}
              </p>
            )}
            <FormField label="Piezas" htmlFor="cz-qty" hint={`De las ${lineQuantity} de la línea.`}>
              <Input id="cz-qty" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-11 md:h-9" />
            </FormField>
            {isQuote && (type?.requiresText || type?.requiresLogo) && (
              <p className="text-xs text-muted-foreground">Los nombres y el logo se piden al convertirlo en pedido.</p>
            )}
            {type?.requiresText && !isQuote && (
              <>
                <FormField label="Texto (igual en todas)" htmlFor="cz-text" optional>
                  <Input id="cz-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Chef Ana" className="h-11 md:h-9" />
                </FormField>
                <FormField label="O un nombre por pieza" htmlFor="cz-names" optional hint="Uno por línea. Puedes pegar la lista.">
                  <Textarea id="cz-names" rows={4} value={names} onChange={(e) => setNames(e.target.value)} placeholder={"Ana\nLuis\nRosa"} />
                </FormField>
                {nameList.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {nameList.length} {nameList.length === 1 ? "nombre" : "nombres"}
                  </p>
                )}
              </>
            )}
            {type?.requiresLogo && !isQuote && (
              <ReceiptField enabled={storageEnabled} name="logo_path" label="Logo (JPG, PNG o PDF)" onPathChange={setLogoPath} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Posición" htmlFor="cz-position" optional>
                <Input id="cz-position" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Pecho izquierdo" className="h-11 md:h-9" />
              </FormField>
              <FormField label="Medida (cm)" htmlFor="cz-size" optional>
                <Input
                  id="cz-size"
                  inputMode="decimal"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder={type?.defaultSizeCm ? String(type.defaultSizeCm) : ""}
                  className="h-11 md:h-9"
                />
              </FormField>
            </div>
            <FormField label="Nota" htmlFor="cz-note" optional>
              <Input id="cz-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hilo dorado" className="h-11 md:h-9" />
            </FormField>
            {error && <StatusAlert tone="error" title={error} />}
          </div>
        )}

        <DialogFooter>
          <Button type="button" className="h-11 md:h-9" disabled={!type} onClick={save}>
            Agregar personalización
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CustomizationDialog

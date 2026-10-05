"use client"

import { DownloadIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/common/components/ui/button"
import { ROUTES } from "@/common/lib/constants/routes.constants"

// Ver el PDF sin descargarlo o descargarlo.
// · Abrir PDF: en una pestaña, con el visor del teléfono o del navegador (todas las páginas).
// · Vista previa (solo en pantallas grandes): dentro de la página. En teléfonos los PDF
//   incrustados no se ven bien (Android no los muestra, iPhone solo la primera página).
const QuotePdfButtons = ({ id, code }: { id: string; code: string }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="h-11 md:h-9">
          <a href={ROUTES.QUOTE_PDF(id)} target="_blank" rel="noopener">
            <ExternalLinkIcon aria-hidden />
            Abrir PDF
          </a>
        </Button>
        <Button type="button" variant="outline" className="hidden h-9 md:inline-flex" onClick={() => setOpen((v) => !v)}>
          {open ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
          {open ? "Ocultar vista previa" : "Vista previa aquí"}
        </Button>
        <Button asChild variant="outline" className="h-11 md:h-9">
          <a href={ROUTES.QUOTE_PDF(id, true)} download={`${code}.pdf`}>
            <DownloadIcon aria-hidden />
            Descargar PDF
          </a>
        </Button>
      </div>
      {open && <iframe title={`PDF de ${code}`} src={ROUTES.QUOTE_PDF(id)} className="hidden h-[80svh] w-full rounded-lg border bg-muted md:block" />}
    </div>
  )
}

export default QuotePdfButtons

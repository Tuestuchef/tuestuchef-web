"use client"

import { DownloadIcon, EyeIcon, EyeOffIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/common/components/ui/button"
import { ROUTES } from "@/common/lib/constants/routes.constants"

// Ver el PDF dentro de la página (se carga solo al abrirlo) o descargarlo.
const QuotePdfButtons = ({ id, code }: { id: string; code: string }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => setOpen((v) => !v)}>
          {open ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
          {open ? "Ocultar PDF" : "Vista previa del PDF"}
        </Button>
        <Button asChild variant="outline" className="h-11 md:h-9">
          <a href={ROUTES.QUOTE_PDF(id, true)} download={`${code}.pdf`}>
            <DownloadIcon aria-hidden />
            Descargar PDF
          </a>
        </Button>
      </div>
      {open && (
        <iframe title={`PDF de ${code}`} src={ROUTES.QUOTE_PDF(id)} className="h-[80svh] w-full rounded-lg border bg-muted" />
      )}
    </div>
  )
}

export default QuotePdfButtons

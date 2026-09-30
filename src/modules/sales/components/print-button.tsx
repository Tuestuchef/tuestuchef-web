"use client"

import { PrinterIcon } from "lucide-react"

import { Button } from "@/common/components/ui/button"

// Imprimir o guardar como PDF desde el navegador.
const PrintButton = () => (
  <Button type="button" className="h-11 md:h-9" onClick={() => window.print()}>
    <PrinterIcon aria-hidden />
    Imprimir o guardar PDF
  </Button>
)

export default PrintButton

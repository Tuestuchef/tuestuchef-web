"use client"

import { PrinterIcon } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@/common/components/ui/button"

// El documento se imprime siempre en claro (en modo oscuro saldría texto claro sobre papel blanco).
const usePrintInLight = () =>
  useEffect(() => {
    const root = document.documentElement
    let wasDark = false
    const before = () => {
      wasDark = root.classList.contains("dark")
      root.classList.remove("dark")
    }
    const after = () => {
      if (wasDark) root.classList.add("dark")
    }
    window.addEventListener("beforeprint", before)
    window.addEventListener("afterprint", after)
    return () => {
      window.removeEventListener("beforeprint", before)
      window.removeEventListener("afterprint", after)
    }
  }, [])

// Imprimir o guardar como PDF desde el navegador (también con Ctrl+P en esta página).
const PrintButton = () => {
  usePrintInLight()
  return (
    <Button type="button" className="h-11 md:h-9" onClick={() => window.print()}>
      <PrinterIcon aria-hidden />
      Imprimir o guardar PDF
    </Button>
  )
}

export default PrintButton

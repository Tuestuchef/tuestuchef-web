"use client"

import { XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useState } from "react"
import { createPortal } from "react-dom"

import PageHelp from "@/common/components/page-help"
import PageHeader from "@/common/components/page-header"
import { Button } from "@/common/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/common/components/ui/dialog"
import type { HelpTopicKey } from "@/common/lib/constants/help.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

// El formulario avisa si tiene algo cargado: así la X pregunta antes de descartarlo.
const DirtyContext = createContext<(dirty: boolean) => void>(() => {})

export const useFormSheetDirty = (dirty: boolean) => {
  const setDirty = useContext(DirtyContext)
  useEffect(() => setDirty(dirty), [dirty, setDirty])
}

const PHONE_QUERY = "(max-width: 767px)"

type MobileFormSheetProps = {
  title: string
  help?: HelpTopicKey
  // Bajo el título, en la computadora.
  description?: React.ReactNode
  // Arriba del título, solo en la computadora (p. ej. el enlace de vuelta al presupuesto).
  desktopTop?: React.ReactNode
  // Qué se pierde al cerrar (en el aviso): "la venta", "el pedido"…
  discardLabel: string
  children: React.ReactNode
}

// En el celular, un formulario largo (registrar una venta) ocupa toda la pantalla, como una app:
// entra desde la derecha, tapa la barra de arriba y las pestañas, y se cierra con la X. Va directo
// en el body (el contenedor de la página usa container queries y encerraría el "fixed").
// En la computadora es una pantalla normal.
const MobileFormSheet = ({ title, help, description, desktopTop, discardLabel, children }: MobileFormSheetProps) => {
  const router = useRouter()
  const [phone, setPhone] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Se decide una sola vez al abrir: cambiar de modo después (p. ej. al girar el teléfono) volvería
  // a montar el formulario y se perdería lo cargado.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única del tamaño de pantalla
    setPhone(window.matchMedia(PHONE_QUERY).matches)
  }, [])

  // Mientras la hoja está abierta en el celular, la página de atrás no se desplaza.
  useEffect(() => {
    if (!phone) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [phone])

  // Volver a donde estaba (saltando la entrada de los pasos, si la hay); si se entró directo, al inicio.
  const leave = () => {
    const entries = typeof (window.history.state as Record<string, unknown> | null)?.formStep === "number" ? 2 : 1
    if (window.history.length > entries) window.history.go(-entries)
    else router.replace(ROUTES.HOME)
  }

  const body = (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      {!phone && desktopTop}
      {!phone && <PageHeader title={title} help={help} description={description} className={desktopTop ? "pt-0" : undefined} />}
      {children}
    </div>
  )

  return (
    <DirtyContext.Provider value={setDirty}>
      {phone
        ? createPortal(
            <div
              data-form-scroll
              className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background [--bottom-nav-h:0px] motion-safe:animate-in motion-safe:duration-300 motion-safe:ease-out motion-safe:slide-in-from-right"
            >
              <div className="sticky top-0 z-20 flex items-center gap-1 border-b bg-background/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
                <Button type="button" variant="ghost" size="icon" className="size-11" onClick={() => (dirty ? setConfirming(true) : leave())}>
                  <XIcon className="size-5" aria-hidden />
                  <span className="sr-only">Cerrar</span>
                </Button>
                <h1 className="min-w-0 flex-1 truncate py-3 text-base font-semibold">{title}</h1>
                {help && <PageHelp topic={help} />}
              </div>
              <div className="px-4 pt-4">{body}</div>
            </div>,
            document.body
          )
        : body}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Descartar {discardLabel}?</DialogTitle>
            <DialogDescription>Lo que cargaste no se guarda.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
              Seguir aquí
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConfirming(false)
                leave()
              }}
            >
              Descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DirtyContext.Provider>
  )
}

export default MobileFormSheet

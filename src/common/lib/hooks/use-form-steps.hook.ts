"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const STATE_KEY = "formStep"

const historyState = () => (window.history.state as Record<string, unknown> | null) ?? {}

// Pasos de un formulario largo (registrar una venta…). El botón atrás del teléfono vuelve un paso
// en vez de salir de la página (y perder lo cargado): fuera del primer paso hay una sola entrada
// extra en el historial; al volver con el botón, se rearma mientras queden pasos atrás.
// `reached` es el paso más lejano visitado: hasta ahí se puede saltar.
export function useFormSteps(count: number) {
  const [step, setStep] = useState(0)
  const [reached, setReached] = useState(0)
  const stepRef = useRef(0)

  const show = useCallback((next: number) => {
    stepRef.current = next
    setStep(next)
    setReached((r) => Math.max(r, next))
    window.scrollTo({ top: 0 })
  }, [])

  useEffect(() => {
    const onPop = () => {
      const saved = historyState()[STATE_KEY]
      if (typeof saved === "number") {
        show(Math.min(Math.max(saved, 0), count - 1))
        return
      }
      // Se salió de la entrada del formulario: un paso atrás (y la entrada vuelve si quedan más).
      const previous = Math.max(stepRef.current - 1, 0)
      if (previous > 0) window.history.pushState({ ...historyState(), [STATE_KEY]: previous }, "")
      show(previous)
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [count, show])

  const goTo = useCallback(
    (next: number) => {
      const target = Math.min(Math.max(next, 0), count - 1)
      const current = stepRef.current
      if (target === current) return
      if (target === 0) {
        // Volver al inicio: se quita la entrada del formulario (el evento muestra el paso 0).
        stepRef.current = 1
        window.history.back()
        return
      }
      // Se conserva el estado que guarda Next.js en el historial.
      const state = { ...historyState(), [STATE_KEY]: target }
      if (current === 0) window.history.pushState(state, "")
      else window.history.replaceState(state, "")
      show(target)
    },
    [count, show]
  )

  // Empezar de nuevo (p. ej. tras guardar sin conexión).
  const reset = useCallback(() => {
    goTo(0)
    setReached(0)
  }, [goTo])

  return {
    step,
    reached,
    goTo,
    next: () => goTo(step + 1),
    back: () => goTo(step - 1),
    reset,
    isFirst: step === 0,
    isLast: step === count - 1,
  }
}

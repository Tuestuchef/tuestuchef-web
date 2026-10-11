"use client"

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"

import { Button } from "@/common/components/ui/button"
import { cn } from "@/common/lib/utils"

type ExpandableListProps = {
  // Cuántas filas se ven claras antes de "Ver todas".
  limit?: number
  total: number
  // Qué se cuenta en el botón ("variantes", "filas").
  noun: string
  className?: string
  children: React.ReactNode
}

// Lista larga recortada: se ven las primeras filas y, bajo una sombra, el comienzo de las siguientes,
// con un botón para verlas todas (y otro para volver a recortarla). Las filas llevan data-row.
const ExpandableList = ({ limit = 7, total, noun, className, children }: ExpandableListProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [collapsedHeight, setCollapsedHeight] = useState<number | null>(null)
  const collapsible = total > limit + 1

  // Alto recortado: las primeras filas, la siguiente y media más (estas dos bajo la sombra).
  useLayoutEffect(() => {
    const container = ref.current
    if (!container || !collapsible) return
    const measure = () => {
      const rows = container.querySelectorAll<HTMLElement>("[data-row]")
      const next = rows[limit]
      if (!next) return
      const top = container.getBoundingClientRect().top
      const half = rows[limit + 1] ? rows[limit + 1].getBoundingClientRect().height / 2 : 0
      setCollapsedHeight(next.getBoundingClientRect().bottom - top + half)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [collapsible, limit, children])

  if (!collapsible) return <div className={className}>{children}</div>

  const collapse = () => {
    setExpanded(false)
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="relative">
        <div
          ref={ref}
          className="overflow-hidden"
          style={!expanded && collapsedHeight !== null ? { maxHeight: collapsedHeight } : undefined}
        >
          {children}
        </div>
        {!expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-card" aria-hidden />
        )}
        {!expanded && (
          <div className="absolute inset-x-0 bottom-2 flex justify-center">
            <Button type="button" variant="outline" size="sm" className="bg-background shadow-sm" onClick={() => setExpanded(true)}>
              <ChevronDownIcon aria-hidden />
              Ver las {total} {noun}
            </Button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="flex justify-center">
          <Button type="button" variant="outline" size="sm" onClick={collapse}>
            <ChevronUpIcon aria-hidden />
            Ver menos
          </Button>
        </div>
      )}
    </div>
  )
}

export default ExpandableList

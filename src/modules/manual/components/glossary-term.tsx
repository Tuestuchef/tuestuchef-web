"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@/common/components/ui/popover"

import { GLOSSARY, type GlossaryKey } from "../lib/constants/glossary.constants"

// Término subrayado: al tocarlo muestra su definición sin salir de la página.
const GlossaryTerm = ({ termKey, children }: { termKey: GlossaryKey; children: React.ReactNode }) => {
  const term = GLOSSARY[termKey]
  const example = "example" in term ? term.example : undefined

  return (
    <Popover>
      <PopoverTrigger className="cursor-help rounded-sm font-medium underline decoration-dotted decoration-2 underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        {children}
      </PopoverTrigger>
      <PopoverContent className="grid gap-2 text-sm">
        <p className="font-medium">{term.term}</p>
        <p className="text-muted-foreground">{term.definition}</p>
        {example && (
          <p className="rounded-md bg-muted p-2 text-xs">
            <span className="font-medium">Ejemplo: </span>
            {example}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

export default GlossaryTerm

import { ArrowRightIcon } from "lucide-react"
import Link from "next/link"

import { ROUTES } from "@/common/lib/constants/routes.constants"
import { cn } from "@/common/lib/utils"

import type { DiagramNode as DiagramNodeValue } from "../../lib/types/manual.types"
import RichText from "../rich-text"

export type ChapterAccess = {
  // Capítulos que el rol puede abrir (los demás no muestran enlace).
  readable: readonly string[]
}

// Enlace "Ver capítulo" solo si el capítulo existe y el rol lo puede leer.
export const ChapterLink = ({ slug, readable, className }: ChapterAccess & { slug?: string; className?: string }) =>
  slug && readable.includes(slug) ? (
    <Link
      href={ROUTES.MANUAL_CHAPTER(slug)}
      className={cn("inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline", className)}
    >
      Ver capítulo
      <ArrowRightIcon className="size-3" aria-hidden />
    </Link>
  ) : null

// La "cajita" de un diagrama: icono, título, detalle y enlace opcional al capítulo.
const DiagramNode = ({
  node,
  readable,
  index,
  emphasis,
  className,
}: ChapterAccess & { node: DiagramNodeValue; index?: number; emphasis?: boolean; className?: string }) => {
  const Icon = node.icon

  return (
    <div
      className={cn(
        "relative flex h-full gap-3 rounded-xl border bg-card p-3 text-card-foreground",
        emphasis && "border-2 border-primary",
        className
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          emphasis ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        )}
      >
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="grid min-w-0 content-start gap-1">
        <p className="text-sm leading-tight font-medium">
          {index !== undefined && <span className="mr-1 text-muted-foreground tabular-nums">{index + 1}.</span>}
          {node.title}
        </p>
        {node.detail && (
          <p className="text-xs text-muted-foreground">
            <RichText text={node.detail} />
          </p>
        )}
        <ChapterLink slug={node.chapter} readable={readable} />
      </div>
    </div>
  )
}

export default DiagramNode

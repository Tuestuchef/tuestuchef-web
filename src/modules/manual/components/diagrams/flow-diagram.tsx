import { ArrowDownIcon, ArrowRightIcon } from "lucide-react"
import { Fragment } from "react"

import type { DiagramNode as DiagramNodeValue } from "../../lib/types/manual.types"
import DiagramNode, { type ChapterAccess } from "./diagram-node"

// Pasos encadenados con flechas: en vertical en el celular y en horizontal en pantallas anchas.
const FlowDiagram = ({ title, nodes, readable }: ChapterAccess & { title?: string; nodes: readonly DiagramNodeValue[] }) => (
  <figure className="grid gap-2">
    {title && <figcaption className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</figcaption>}
    <ol className="flex flex-col items-stretch lg:flex-row">
      {nodes.map((node, index) => (
        <Fragment key={node.title}>
          {index > 0 && (
            <li aria-hidden className="flex shrink-0 items-center justify-center py-1 text-muted-foreground lg:px-1 lg:py-0">
              <ArrowDownIcon className="size-4 lg:hidden" />
              <ArrowRightIcon className="hidden size-4 lg:block" />
            </li>
          )}
          <li className="min-w-0 lg:flex-1">
            <DiagramNode node={node} index={nodes.length > 1 ? index : undefined} readable={readable} />
          </li>
        </Fragment>
      ))}
    </ol>
  </figure>
)

export default FlowDiagram

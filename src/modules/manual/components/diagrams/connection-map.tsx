import { ArrowDownIcon, ArrowRightIcon } from "lucide-react"

import type { DiagramNode as DiagramNodeValue, ModuleLink } from "../../lib/types/manual.types"
import { ChapterLink, type ChapterAccess } from "./diagram-node"

const LinkItem = ({ link, readable }: ChapterAccess & { link: ModuleLink }) => {
  const Icon = link.icon
  return (
    <li className="flex items-start gap-2.5 rounded-lg border bg-card p-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="grid min-w-0 gap-0.5">
        <p className="text-sm leading-tight font-medium">{link.title}</p>
        <p className="text-xs text-muted-foreground">{link.effect}</p>
        <ChapterLink slug={link.chapter} readable={readable} />
      </div>
    </li>
  )
}

const Column = ({ label, links, readable }: ChapterAccess & { label: string; links: readonly ModuleLink[] }) => (
  <div className="grid content-start gap-2">
    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
    <ul className="grid gap-2">
      {links.map((link) => (
        <LinkItem key={link.title} link={link} readable={readable} />
      ))}
    </ul>
  </div>
)

const Arrow = () => (
  <div aria-hidden className="flex items-center justify-center text-muted-foreground">
    <ArrowDownIcon className="size-5 md:hidden" />
    <ArrowRightIcon className="hidden size-5 md:block" />
  </div>
)

// Mapa de conexiones: lo que el módulo recibe (izquierda) y lo que cambia en otros (derecha).
const ConnectionMap = ({
  center,
  inputs,
  outputs,
  readable,
}: ChapterAccess & { center: DiagramNodeValue; inputs: readonly ModuleLink[]; outputs: readonly ModuleLink[] }) => {
  const Icon = center.icon

  return (
    <figure className="grid gap-3 rounded-xl border border-dashed p-3 md:grid-cols-[1fr_auto_auto_auto_1fr] md:items-center md:gap-3">
      <Column label="Recibe de" links={inputs} readable={readable} />
      <Arrow />
      <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-primary bg-primary p-4 text-primary-foreground md:min-w-32">
        <Icon className="size-7" aria-hidden />
        <span className="text-sm font-semibold">{center.title}</span>
      </div>
      <Arrow />
      <Column label="Afecta a" links={outputs} readable={readable} />
      <figcaption className="sr-only">
        {center.title} recibe de {inputs.map((i) => i.title).join(", ")} y afecta a {outputs.map((o) => o.title).join(", ")}.
      </figcaption>
    </figure>
  )
}

export default ConnectionMap

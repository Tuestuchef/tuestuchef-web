import { ChevronDownIcon, CircleAlertIcon, InfoIcon } from "lucide-react"

import { ROLE_LABELS } from "@/common/lib/constants/roles.constants"
import { cn } from "@/common/lib/utils"

import type { ManualBlock as ManualBlockValue } from "../lib/types/manual.types"
import ConnectionMap from "./diagrams/connection-map"
import { ChapterLink, type ChapterAccess } from "./diagrams/diagram-node"
import FlowDiagram from "./diagrams/flow-diagram"
import MoneySplit from "./diagrams/money-split"
import Timeline from "./diagrams/timeline"
import RichText from "./rich-text"

// Dibuja un bloque del manual según su tipo.
const ManualBlock = ({ block, readable }: ChapterAccess & { block: ManualBlockValue }) => {
  switch (block.kind) {
    case "text":
      return (
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          <RichText text={block.body} />
        </p>
      )

    case "callout": {
      const Icon = block.tone === "warning" ? CircleAlertIcon : InfoIcon
      return (
        <aside
          className={cn(
            "flex gap-3 rounded-xl border p-3",
            block.tone === "warning" ? "border-2 border-foreground/40 bg-muted" : "bg-muted/50"
          )}
        >
          <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="grid gap-1">
            <p className="text-sm font-semibold">
              <span className="sr-only">{block.tone === "warning" ? "Importante: " : "Nota: "}</span>
              {block.title}
            </p>
            <p className="text-sm text-muted-foreground">
              <RichText text={block.body} />
            </p>
          </div>
        </aside>
      )
    }

    case "steps":
      return (
        <ol className="grid gap-2">
          {block.items.map((item, index) => (
            <li key={item.title} className="flex gap-3 rounded-xl border p-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums">
                {index + 1}
              </span>
              <div className="grid gap-0.5 pt-0.5">
                <p className="text-sm font-medium">{item.title}</p>
                {item.body && (
                  <p className="text-sm text-muted-foreground">
                    <RichText text={item.body} />
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )

    case "flow":
      return <FlowDiagram title={block.title} nodes={block.nodes} readable={readable} />

    case "connections":
      return <ConnectionMap center={block.center} inputs={block.inputs} outputs={block.outputs} readable={readable} />

    case "effects":
      return (
        <ul className="grid gap-2 sm:grid-cols-2">
          {block.items.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.title} className="flex gap-3 rounded-xl border p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-5" aria-hidden />
                </div>
                <div className="grid content-start gap-0.5">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.effect}</p>
                  <ChapterLink slug={item.chapter} readable={readable} />
                </div>
              </li>
            )
          })}
        </ul>
      )

    case "money-split":
      return <MoneySplit title={block.title} total={block.total} parts={block.parts} unit={block.unit} />

    case "timeline":
      return <Timeline title={block.title} steps={block.steps} note={block.note} />

    case "example":
      return (
        <figure className="overflow-hidden rounded-xl border">
          <figcaption className="border-b bg-muted px-3 py-2 text-sm font-medium">Ejemplo: {block.title}</figcaption>
          <dl className="divide-y">
            {block.rows.map((row) => (
              <div
                key={row.label}
                className={cn("grid gap-0.5 px-3 py-2 sm:grid-cols-[1fr_auto] sm:gap-4", row.total && "bg-muted/50 font-semibold")}
              >
                <dt className="text-sm">{row.label}</dt>
                <dd className="text-sm tabular-nums sm:text-right">{row.value}</dd>
                {row.note && (
                  <dd className="text-xs font-normal text-muted-foreground sm:col-span-2">
                    <RichText text={row.note} />
                  </dd>
                )}
              </div>
            ))}
          </dl>
          {block.conclusion && (
            <p className="border-t px-3 py-2 text-sm text-muted-foreground">
              <RichText text={block.conclusion} />
            </p>
          )}
        </figure>
      )

    case "faq":
      return (
        <div className="grid gap-2">
          {block.items.map((item) => (
            <details key={item.question} className="group rounded-xl border p-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
                {item.question}
                <ChevronDownIcon className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="pt-2 text-sm text-muted-foreground">
                <RichText text={item.answer} />
              </p>
            </details>
          ))}
        </div>
      )

    case "roles":
      return (
        <dl className="grid gap-2">
          {block.items.map((item) => (
            <div key={item.role} className="grid gap-1 rounded-xl border p-3 sm:grid-cols-[8rem_1fr] sm:gap-3">
              <dt className="text-sm font-semibold">{ROLE_LABELS[item.role]}</dt>
              <dd className="text-sm text-muted-foreground">
                <RichText text={item.can} />
              </dd>
            </div>
          ))}
        </dl>
      )
  }
}

export default ManualBlock

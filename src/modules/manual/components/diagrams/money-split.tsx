import { cn } from "@/common/lib/utils"

import type { MoneyPart } from "../../lib/types/manual.types"
import RichText from "../rich-text"

// Cada parte se distingue por patrón (no solo por tono): sólido, rayado, punteado, cuadriculado.
const PATTERNS = [
  "bg-chart-1",
  "bg-[repeating-linear-gradient(135deg,var(--chart-3)_0_3px,transparent_3px_7px)]",
  "bg-[radial-gradient(var(--chart-2)_1.5px,transparent_1.5px)] bg-size-[6px_6px]",
  "bg-[linear-gradient(var(--chart-4)_1px,transparent_1px),linear-gradient(90deg,var(--chart-4)_1px,transparent_1px)] bg-size-[6px_6px]",
] as const

const format = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const percent = new Intl.NumberFormat("es-VE", { style: "percent", maximumFractionDigits: 0 })

// Barra que reparte un monto en partes, con leyenda: "de estos 28, 22,40 llegan y 5,60 se pierden".
const MoneySplit = ({
  title,
  total,
  parts,
  unit,
}: {
  title: string
  total: MoneyPart
  parts: readonly MoneyPart[]
  unit: string
}) => (
  <figure className="grid gap-3 rounded-xl border p-3">
    <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {total.label}: {format.format(total.amount)} {unit}
      </span>
    </figcaption>
    <div className="flex h-10 overflow-hidden rounded-lg border" aria-hidden>
      {parts.map((part, index) => (
        <div
          key={part.label}
          className={cn("h-full border-r last:border-r-0", PATTERNS[index % PATTERNS.length])}
          style={{ width: `${(part.amount / total.amount) * 100}%` }}
        />
      ))}
    </div>
    <ul className="grid gap-2 sm:grid-cols-2">
      {parts.map((part, index) => (
        <li key={part.label} className="flex items-start gap-2 text-sm">
          <span aria-hidden className={cn("mt-0.5 size-4 shrink-0 rounded-sm border", PATTERNS[index % PATTERNS.length])} />
          <div className="grid gap-0.5">
            <span>
              <span className="font-medium">{part.label}</span>{" "}
              <span className="tabular-nums">
                {format.format(part.amount)} {unit} ({percent.format(part.amount / total.amount)})
              </span>
            </span>
            {part.note && (
              <span className="text-xs text-muted-foreground">
                <RichText text={part.note} />
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  </figure>
)

export default MoneySplit

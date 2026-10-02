import type { RichText as RichTextValue, TimelineStep } from "../../lib/types/manual.types"
import RichText from "../rich-text"

// Estados en orden, unidos por una línea: vertical en el celular y horizontal en pantallas anchas.
const Timeline = ({ title, steps, note }: { title?: string; steps: readonly TimelineStep[]; note?: RichTextValue }) => (
  <figure className="grid gap-3 rounded-xl border p-3">
    {title && <figcaption className="text-sm font-medium">{title}</figcaption>}
    <ol className="grid gap-0 md:grid-flow-col md:auto-cols-fr">
      {steps.map((step, index) => (
        <li key={step.title} className="relative flex gap-3 pb-4 last:pb-0 md:flex-col md:gap-2 md:pr-3 md:pb-0">
          {/* Línea que une con el siguiente paso */}
          {index < steps.length - 1 && (
            <span
              aria-hidden
              className="absolute top-8 bottom-0 left-3.75 w-px bg-border md:top-3.75 md:right-0 md:bottom-auto md:left-8 md:h-px md:w-auto"
            />
          )}
          <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background text-xs font-semibold tabular-nums">
            {index + 1}
          </span>
          <div className="grid gap-0.5 pt-1 md:pt-0">
            <p className="text-sm font-medium">{step.title}</p>
            {step.detail && (
              <p className="text-xs text-muted-foreground">
                <RichText text={step.detail} />
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
    {note && (
      <p className="border-t pt-2 text-xs text-muted-foreground">
        <RichText text={note} />
      </p>
    )}
  </figure>
)

export default Timeline

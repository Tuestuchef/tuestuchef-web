import type { LucideIcon } from "lucide-react"

import type { AppRole } from "@/common/lib/constants/roles.constants"

// Texto del manual. Admite marcas en línea:
//   **negrita**
//   [[termino]] o [[termino|texto visible]]  → término del glosario (se abre al tocarlo)
export type RichText = string

export type ManualAreaKey = "comercial" | "inventario" | "compras" | "tesoreria" | "resultados" | "rrhh" | "configuracion"

export type ManualArea = {
  key: ManualAreaKey
  title: string
  // Qué parte de la administración es, en palabras simples.
  discipline: string
  description: RichText
  icon: LucideIcon
}

// Un nodo de un diagrama: una "cajita" con icono y texto.
export type DiagramNode = {
  icon: LucideIcon
  title: string
  detail?: RichText
  // Capítulo del manual al que lleva (si lo hay).
  chapter?: string
}

// Una conexión con otro módulo: qué recibe de él o qué le cambia.
export type ModuleLink = DiagramNode & {
  // Lo que pasa por la flecha (p. ej. "descuenta stock").
  effect: string
}

export type MoneyPart = {
  label: string
  amount: number
  // Moneda propia si no es la del diagrama (p. ej. el precio en USD frente a partes en USDT).
  unit?: string
  note?: RichText
}

export type TimelineStep = {
  title: string
  detail?: RichText
}

export type ExampleRow = {
  label: string
  value: string
  note?: RichText
  // Fila de resultado (se resalta).
  total?: boolean
}

export type ManualBlock =
  | { kind: "text"; body: RichText }
  | { kind: "callout"; tone: "info" | "warning"; title: string; body: RichText }
  | { kind: "steps"; items: readonly { title: string; body?: RichText }[] }
  | { kind: "flow"; title?: string; nodes: readonly DiagramNode[] }
  | {
      kind: "connections"
      center: DiagramNode
      inputs: readonly ModuleLink[]
      outputs: readonly ModuleLink[]
    }
  | { kind: "effects"; items: readonly ModuleLink[] }
  | { kind: "money-split"; title: string; total: MoneyPart; parts: readonly MoneyPart[]; unit: string }
  | { kind: "timeline"; title?: string; steps: readonly TimelineStep[]; note?: RichText }
  | { kind: "example"; title: string; rows: readonly ExampleRow[]; conclusion?: RichText }
  | { kind: "faq"; items: readonly { question: string; answer: RichText }[] }
  | { kind: "roles"; items: readonly { role: AppRole; can: RichText }[] }

export type ManualSection = {
  id: string
  heading: string
  blocks: readonly ManualBlock[]
  // Sección solo para estos roles (por defecto, todos los del capítulo).
  roles?: readonly AppRole[]
}

export type ManualChapter = {
  slug: string
  area: ManualAreaKey
  title: string
  summary: RichText
  icon: LucideIcon
  roles: readonly AppRole[]
  // Pantallas del sistema que explica (para ir directo desde el manual).
  screens: readonly { title: string; url: string; roles: readonly AppRole[] }[]
  sections: readonly ManualSection[]
  related?: readonly string[]
}

// Capítulo planificado que aún no está escrito: aparece en el índice como "pronto".
export type ManualChapterStub = Pick<ManualChapter, "slug" | "area" | "title" | "summary" | "icon" | "roles">

export type GlossaryTerm = {
  key: string
  term: string
  definition: RichText
  example?: RichText
}

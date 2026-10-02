import type { AppRole } from "@/common/lib/constants/roles.constants"

import { GLOSSARY, type GlossaryKey } from "../constants/glossary.constants"
import { MANUAL_AREA_ORDER } from "../constants/manual-areas.constants"
import { MANUAL_CHAPTERS, MANUAL_STUBS } from "../constants/manual-chapters.constants"
import type { ManualAreaKey, ManualChapter, RichText } from "../types/manual.types"

export type RichSegment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "term"; key: GlossaryKey; value: string }

// Nombre del término dentro de una frase: "Valor real (USDT)" → "valor real"; siglas intactas (USDT, BCV).
const inlineTerm = (term: string) => {
  const base = term.replace(/\s*\(.*\)$/, "")
  return /^[A-ZÁÉÍÓÚ][a-záéíóúñ]/.test(base) ? base[0].toLowerCase() + base.slice(1) : base
}

// **negrita** y [[termino]] / [[termino|texto]]. Un término desconocido se muestra como texto.
export const parseRichText = (text: RichText): RichSegment[] => {
  const segments: RichSegment[] = []
  const pattern = /\*\*(.+?)\*\*|\[\[([a-z0-9-]+)(?:\|(.+?))?\]\]/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) segments.push({ type: "text", value: text.slice(last, match.index) })
    if (match[1] !== undefined) {
      segments.push({ type: "bold", value: match[1] })
    } else if (match[2] in GLOSSARY) {
      const key = match[2] as GlossaryKey
      segments.push({ type: "term", key, value: match[3] ?? inlineTerm(GLOSSARY[key].term) })
    } else {
      segments.push({ type: "text", value: match[3] ?? match[2] })
    }
    last = match.index + match[0].length
  }
  if (last < text.length) segments.push({ type: "text", value: text.slice(last) })
  return segments
}

export const findChapter = (slug: string, role: AppRole): ManualChapter | undefined =>
  MANUAL_CHAPTERS.find((chapter) => chapter.slug === slug && chapter.roles.includes(role))

// Índice por área: lo escrito y lo planificado que el rol puede ver.
export const chaptersByArea = (role: AppRole) =>
  MANUAL_AREA_ORDER.map((area: ManualAreaKey) => ({
    area,
    chapters: MANUAL_CHAPTERS.filter((c) => c.area === area && c.roles.includes(role)),
    upcoming: MANUAL_STUBS.filter((c) => c.area === area && c.roles.includes(role)),
  })).filter((group) => group.chapters.length + group.upcoming.length > 0)

// Texto sin marcas (para resúmenes de una línea).
export const plainText = (text: RichText) =>
  parseRichText(text)
    .map((segment) => segment.value)
    .join("")

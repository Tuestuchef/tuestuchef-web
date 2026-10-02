import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { HELP_TOPICS } from "@/common/lib/constants/help.constants"
import type { AppRole } from "@/common/lib/constants/roles.constants"

import ManualChapterScreen from "../../screens/manual-chapter-screen"
import ManualScreen from "../../screens/manual-screen"
import { GLOSSARY } from "../constants/glossary.constants"
import { MANUAL_CHAPTERS } from "../constants/manual-chapters.constants"
import { parseRichText } from "./manual.util"

const slugs = new Set(MANUAL_CHAPTERS.map((chapter) => chapter.slug))
const ROLES: readonly AppRole[] = ["owner", "admin", "staff"]

// Todo el texto y los enlaces a capítulos de un valor (recorre el contenido sin conocer su forma).
const collect = (value: unknown, texts: string[], links: string[]) => {
  if (typeof value === "string") texts.push(value)
  else if (Array.isArray(value)) value.forEach((item) => collect(item, texts, links))
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if ((key === "chapter" || key === "related") && item) links.push(...([] as string[]).concat(item as string | string[]))
      else collect(item, texts, links)
    }
  }
}

describe("manual", () => {
  it("cada término del glosario y cada enlace existe", () => {
    for (const chapter of MANUAL_CHAPTERS) {
      const texts: string[] = []
      const links: string[] = []
      collect(chapter, texts, links)
      for (const text of texts) {
        for (const [, key] of text.matchAll(/\[\[([a-z0-9-]+)/g)) {
          expect(key in GLOSSARY, `${chapter.slug}: término desconocido "${key}"`).toBe(true)
        }
        expect(parseRichText(text).some((s) => s.type === "text" && /\*\*|\[\[|\]\]/.test(s.value)), `${chapter.slug}: marca sin cerrar en "${text}"`).toBe(false)
      }
      for (const link of links) expect(slugs.has(link), `${chapter.slug}: capítulo inexistente "${link}"`).toBe(true)
    }
  })

  it("la ayuda de cada pantalla apunta a un capítulo que existe", () => {
    for (const [key, topic] of Object.entries(HELP_TOPICS)) {
      if ("chapter" in topic) expect(slugs.has(topic.chapter), `${key} → ${topic.chapter}`).toBe(true)
    }
  })

  it("los slugs e ids de sección no se repiten", () => {
    expect(slugs.size).toBe(MANUAL_CHAPTERS.length)
    for (const chapter of MANUAL_CHAPTERS) {
      const ids = chapter.sections.map((section) => section.id)
      expect(new Set(ids).size, chapter.slug).toBe(ids.length)
    }
  })

  it("se dibuja para cada rol sin mostrar capítulos que no le tocan", () => {
    for (const role of ROLES) {
      const index = renderToString(createElement(ManualScreen, { role }))
      for (const chapter of MANUAL_CHAPTERS) {
        const linked = index.includes(`href="/manual/${chapter.slug}"`)
        expect(linked, `${role} → ${chapter.slug}`).toBe(chapter.roles.includes(role))
        if (!chapter.roles.includes(role)) continue
        const html = renderToString(createElement(ManualChapterScreen, { chapter, role }))
        expect(html).not.toMatch(/\*\*|\[\[/)
        // Ningún enlace a un capítulo que el rol no puede abrir.
        for (const [, slug] of html.matchAll(/href="\/manual\/([a-z-]+)"/g)) {
          expect(MANUAL_CHAPTERS.find((c) => c.slug === slug)?.roles.includes(role), `${role} en ${chapter.slug} → ${slug}`).toBe(true)
        }
      }
    }
  })
})

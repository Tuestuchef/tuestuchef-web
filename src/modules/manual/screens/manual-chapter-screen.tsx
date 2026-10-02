import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@/common/components/ui/button"
import type { AppRole } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import ManualBlock from "../components/manual-block"
import RichText from "../components/rich-text"
import { MANUAL_AREAS } from "../lib/constants/manual-areas.constants"
import { MANUAL_CHAPTERS } from "../lib/constants/manual-chapters.constants"
import type { ManualChapter } from "../lib/types/manual.types"

const ManualChapterScreen = ({ chapter, role }: { chapter: ManualChapter; role: AppRole }) => {
  const area = MANUAL_AREAS[chapter.area]
  const AreaIcon = area.icon
  const readable = MANUAL_CHAPTERS.filter((c) => c.roles.includes(role)).map((c) => c.slug)
  const sections = chapter.sections.filter((section) => !section.roles || section.roles.includes(role))
  const screens = chapter.screens.filter((screen) => screen.roles.includes(role))
  const related = MANUAL_CHAPTERS.filter((c) => chapter.related?.includes(c.slug) && c.roles.includes(role))

  return (
    <article className="mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)] gap-6">
      <header className="grid gap-3 pt-2">
        <Link
          href={ROUTES.MANUAL}
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
          Manual
        </Link>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
          <AreaIcon className="size-3.5" aria-hidden />
          {area.title} · {area.discipline}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{chapter.title}</h1>
        <p className="text-muted-foreground md:text-lg">
          <RichText text={chapter.summary} />
        </p>
        {screens.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {screens.map((screen) => (
              <Button key={screen.url} asChild variant="outline" size="sm" className="h-9">
                <Link href={screen.url}>
                  {screen.title}
                  <ExternalLinkIcon aria-hidden />
                </Link>
              </Button>
            ))}
          </div>
        )}
      </header>

      {/* Índice del capítulo: en el celular se desliza de lado. */}
      <nav aria-label="En este capítulo" className="sticky top-(--header-height) z-5 -mx-4 border-y bg-background/95 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
        <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {sections.map((section) => (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                className="inline-flex h-8 items-center rounded-full border px-3 text-xs transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {section.heading}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {sections.map((section) => (
        <section key={section.id} id={section.id} className="grid scroll-mt-28 gap-3" aria-labelledby={`${section.id}-title`}>
          <h2 id={`${section.id}-title`} className="text-lg font-semibold">
            {section.heading}
          </h2>
          {section.blocks.map((block, index) => (
            <ManualBlock key={index} block={block} readable={readable} />
          ))}
        </section>
      ))}

      {related.length > 0 && (
        <footer className="grid gap-2 border-t pt-4">
          <h2 className="text-sm font-medium text-muted-foreground">Sigue leyendo</h2>
          <ul className="flex flex-wrap gap-2">
            {related.map((c) => (
              <li key={c.slug}>
                <Button asChild variant="secondary" size="sm" className="h-9">
                  <Link href={ROUTES.MANUAL_CHAPTER(c.slug)}>{c.title}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </footer>
      )}
    </article>
  )
}

export default ManualChapterScreen

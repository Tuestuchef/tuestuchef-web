import { ArrowRightIcon } from "lucide-react"
import Link from "next/link"

import PageHeader from "@/common/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import type { AppRole } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import BusinessMap from "../components/business-map"
import RichText from "../components/rich-text"
import { GLOSSARY } from "../lib/constants/glossary.constants"
import { MANUAL_AREAS } from "../lib/constants/manual-areas.constants"
import { chaptersByArea, plainText } from "../lib/utils/manual.util"

const ManualScreen = ({ role }: { role: AppRole }) => {
  const groups = chaptersByArea(role)
  const readable = groups.flatMap((group) => group.chapters.map((chapter) => chapter.slug))
  const terms = Object.values(GLOSSARY).sort((a, b) => a.term.localeCompare(b.term, "es"))

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      <PageHeader
        title="Manual"
        description="Cómo funciona cada parte del sistema, qué cambia cuando la usas y cómo se conecta con las demás."
      />

      <Card>
        <CardHeader>
          <CardTitle>El negocio en un mapa</CardTitle>
          <CardDescription>
            El recorrido de una filipina, desde la tela hasta la utilidad. Cada paso es un área del sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BusinessMap readable={readable} />
        </CardContent>
      </Card>

      <section className="grid gap-6" aria-labelledby="areas">
        <h2 id="areas" className="text-lg font-semibold">
          Capítulos por área
        </h2>
        {groups.map(({ area: key, chapters, upcoming }) => {
          const area = MANUAL_AREAS[key]
          const AreaIcon = area.icon
          return (
            <div key={key} className="grid gap-3">
              <div className="flex gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <AreaIcon className="size-5" aria-hidden />
                </div>
                <div className="grid gap-0.5">
                  <h3 className="font-medium">
                    {area.title} <span className="text-sm font-normal text-muted-foreground">· {area.discipline}</span>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <RichText text={area.description} />
                  </p>
                </div>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {chapters.map((chapter) => {
                  const Icon = chapter.icon
                  return (
                    <li key={chapter.slug}>
                      <Link
                        href={ROUTES.MANUAL_CHAPTER(chapter.slug)}
                        className="flex h-full gap-3 rounded-xl border bg-card p-3 transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
                        <div className="grid flex-1 gap-0.5">
                          <span className="text-sm font-medium">{chapter.title}</span>
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            {plainText(chapter.summary)}
                          </span>
                        </div>
                        <ArrowRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  )
                })}
                {upcoming.map((chapter) => {
                  const Icon = chapter.icon
                  return (
                    <li key={chapter.slug} className="flex gap-3 rounded-xl border border-dashed p-3 text-muted-foreground">
                      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
                      <div className="grid flex-1 gap-0.5">
                        <span className="text-sm font-medium">{chapter.title}</span>
                        <span className="line-clamp-2 text-xs">{plainText(chapter.summary)}</span>
                      </div>
                      <span className="shrink-0 text-xs">Pronto</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </section>

      <section className="grid gap-3" aria-labelledby="glosario">
        <div className="grid gap-1">
          <h2 id="glosario" className="text-lg font-semibold">
            Glosario
          </h2>
          <p className="text-sm text-muted-foreground">
            Las palabras que usa el sistema, sin jerga. En los capítulos aparecen subrayadas: tócalas para ver qué significan.
          </p>
        </div>
        <dl className="grid gap-2 sm:grid-cols-2">
          {terms.map((term) => (
            <div key={term.key} id={term.key} className="grid content-start gap-1 rounded-xl border p-3">
              <dt className="text-sm font-medium">{term.term}</dt>
              <dd className="text-sm text-muted-foreground">{term.definition}</dd>
              {"example" in term && (
                <dd className="rounded-md bg-muted p-2 text-xs">
                  <span className="font-medium">Ejemplo: </span>
                  {term.example}
                </dd>
              )}
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}

export default ManualScreen

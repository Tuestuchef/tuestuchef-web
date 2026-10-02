import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import { MANUAL_CHAPTERS } from "@/modules/manual/lib/constants/manual-chapters.constants"
import { findChapter } from "@/modules/manual/lib/utils/manual.util"
import ManualChapterScreen from "@/modules/manual/screens/manual-chapter-screen"

export async function generateMetadata({ params }: PageProps<"/manual/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const chapter = MANUAL_CHAPTERS.find((c) => c.slug === slug)
  return { title: chapter ? `Manual: ${chapter.title}` : "Manual" }
}

export default async function ManualChapterPage({ params }: PageProps<"/manual/[slug]">) {
  const user = await requireRole(ROLE_GROUPS.ALL)
  const { slug } = await params
  const chapter = findChapter(slug, user.role)
  if (!chapter) notFound()
  return <ManualChapterScreen chapter={chapter} role={user.role} />
}

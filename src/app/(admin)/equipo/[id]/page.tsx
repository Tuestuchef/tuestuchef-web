import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import TeamMemberScreen from "@/modules/team/screens/team-member-screen"

export const metadata: Metadata = { title: "Persona del equipo" }

export default async function TeamMemberPage({ params }: PageProps<"/equipo/[id]">) {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  return <TeamMemberScreen id={id} />
}

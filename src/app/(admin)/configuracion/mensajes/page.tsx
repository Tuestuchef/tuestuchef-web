import type { Metadata } from "next"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { requireRole } from "@/common/lib/services/session.service"
import MessageTemplatesScreen from "@/modules/messages/screens/message-templates-screen"

export const metadata: Metadata = { title: "Mensajes de WhatsApp" }

export default async function MessageTemplatesPage() {
  await requireRole(ROLE_GROUPS.MANAGEMENT)
  return <MessageTemplatesScreen />
}

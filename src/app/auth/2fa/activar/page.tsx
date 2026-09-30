import type { Metadata } from "next"

import { getSessionState, redirectForSession } from "@/common/lib/services/session.service"
import MfaSetupScreen from "@/modules/auth/screens/mfa-setup-screen"

export const metadata: Metadata = { title: "Activa la verificación en dos pasos" }

export default async function MfaSetupPage() {
  const session = await getSessionState()
  if (session.status !== "mfa_setup") redirectForSession(session)
  return <MfaSetupScreen user={session.user} />
}

import type { Metadata } from "next"

import { getSessionState, redirectForSession } from "@/common/lib/services/session.service"
import MfaVerifyScreen from "@/modules/auth/screens/mfa-verify-screen"

export const metadata: Metadata = { title: "Verificación en dos pasos" }

export default async function MfaVerifyPage() {
  const session = await getSessionState()
  if (session.status !== "mfa_verify") redirectForSession(session)
  return <MfaVerifyScreen factorId={session.factorId} />
}

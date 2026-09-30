import type { Metadata } from "next"

import {
  REDIRECT_PARAM,
  SIGN_OUT_REASON_PARAM,
} from "@/common/lib/constants/routes.constants"
import LoginScreen from "@/modules/auth/screens/login-screen"

export const metadata: Metadata = { title: "Iniciar sesión" }

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams
  const redirectTo = params[REDIRECT_PARAM]
  const reason = params[SIGN_OUT_REASON_PARAM]

  return (
    <LoginScreen
      redirectTo={typeof redirectTo === "string" ? redirectTo : undefined}
      signOutReason={typeof reason === "string" ? reason : undefined}
    />
  )
}

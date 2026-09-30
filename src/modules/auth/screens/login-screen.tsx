import StatusAlert from "@/common/components/status-alert"

import AuthCard from "../components/auth-card"
import LoginForm from "../components/login-form"
import { SIGN_OUT_REASONS } from "../lib/constants/auth.constants"

type LoginScreenProps = {
  redirectTo?: string
  signOutReason?: string
}

const LoginScreen = ({ redirectTo = "/", signOutReason }: LoginScreenProps) => {
  const reasonMessage = signOutReason ? SIGN_OUT_REASONS[signOutReason] : undefined

  return (
    <AuthCard title="Iniciar sesión" description="Sin contraseña: te enviamos un código a tu correo.">
      {reasonMessage && <StatusAlert tone="warning" title={reasonMessage} />}
      <LoginForm redirectTo={redirectTo} />
    </AuthCard>
  )
}

export default LoginScreen

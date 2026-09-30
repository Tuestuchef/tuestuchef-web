import AuthCard from "../components/auth-card"
import MfaCodeForm from "../components/mfa-code-form"

const MfaVerifyScreen = ({ factorId }: { factorId: string }) => (
  <AuthCard
    title="Verificación en dos pasos"
    description="Escribe el código de 6 dígitos de tu app autenticadora."
    showSignOut
  >
    <MfaCodeForm factorId={factorId} submitLabel="Entrar" />
  </AuthCard>
)

export default MfaVerifyScreen

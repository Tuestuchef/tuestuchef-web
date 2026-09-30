import { ROLE_LABELS } from "@/common/lib/constants/roles.constants"
import type { SessionUser } from "@/common/lib/types/session.types"

import AuthCard from "../components/auth-card"
import MfaSetupForm from "../components/mfa-setup-form"

const MfaSetupScreen = ({ user }: { user: SessionUser }) => (
  <AuthCard
    title="Activa la verificación en dos pasos"
    description={`Como ${ROLE_LABELS[user.role].toLowerCase()}, necesitas una app autenticadora además del código por correo. Solo se hace una vez.`}
    showSignOut
  >
    <MfaSetupForm />
  </AuthCard>
)

export default MfaSetupScreen

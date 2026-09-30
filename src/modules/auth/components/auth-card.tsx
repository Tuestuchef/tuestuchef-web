import BrandLogo from "@/common/components/brand-logo"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/common/components/ui/card"
import { brandConfig } from "@/common/lib/config/brand.config"
import { ROUTES } from "@/common/lib/constants/routes.constants"

type AuthCardProps = {
  title: string
  description: React.ReactNode
  children: React.ReactNode
  // Muestra "Salir" (para quien ya tiene sesión pero no terminó el acceso).
  showSignOut?: boolean
}

// Marco de las pantallas de acceso: login y verificación en dos pasos.
const AuthCard = ({ title, description, children, showSignOut }: AuthCardProps) => (
  <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-4 md:p-10">
    <BrandLogo variant="full" priority />
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
    {showSignOut ? (
      <form action={ROUTES.SIGN_OUT} method="post">
        <button type="submit" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Salir y entrar con otro correo
        </button>
      </form>
    ) : (
      <p className="text-center text-xs text-muted-foreground">
        {brandConfig.name} · {brandConfig.slogan}
      </p>
    )}
  </main>
)

export default AuthCard

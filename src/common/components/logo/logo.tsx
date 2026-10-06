import Image from "next/image"

import LogoFull from "@/common/assets/logo/logo-full"
import logoGradient from "@/common/assets/logo/logo-gradient.png"
import LogoIcon from "@/common/assets/logo/logo-icon"
import LogoLettering from "@/common/assets/logo/logo-lettering"
import { brandConfig } from "@/common/lib/config/brand.config"
import { cn } from "@/common/lib/utils"

// "auto" sigue al tema (negro en claro, blanco en oscuro); "black" y "white" son fijos para fondos
// que no cambian con el tema (el sidebar siempre es negro); "current" hereda el color del texto.
export type LogoColor = "auto" | "black" | "white" | "current"

type LogoProps = {
  // full: ícono + letras · icon: solo el ícono · lettering: solo las letras
  // gradient: ícono a color · gradient-full: ícono a color + letras
  variant?: "full" | "icon" | "lettering" | "gradient" | "gradient-full"
  // Color del trazo; en gradient-full, el de las letras (el ícono a color no cambia).
  color?: LogoColor
  // full y gradient-full: letras debajo del ícono (stacked) o al lado (inline).
  layout?: "stacked" | "inline"
  // El tamaño lo da la altura: className="h-8".
  className?: string
  // Lado mayor (px) con el que se pide la imagen del ícono a color.
  imageSize?: number
  priority?: boolean
  // Sin etiqueta para lectores de pantalla (cuando el nombre ya está al lado).
  decorative?: boolean
}

const COLOR_CLASS: Record<LogoColor, string | null> = {
  auto: "text-foreground",
  black: "text-ink",
  white: "text-paper",
  current: null,
}

const GradientIcon = ({ className, size, priority }: { className?: string; size: number; priority?: boolean }) => (
  <Image src={logoGradient} alt="" aria-hidden width={size} height={size} priority={priority} className={cn("aspect-square h-full w-auto", className)} />
)

// Único punto de entrada al logo: nadie importa los archivos de src/common/assets/logo directamente.
const Logo = ({ variant = "full", color = "auto", layout = "stacked", className, imageSize = 128, priority, decorative }: LogoProps) => {
  const colorClass = COLOR_CLASS[color]
  const label = decorative ? ({ "aria-hidden": true } as const) : ({ role: "img", "aria-label": brandConfig.name } as const)

  if (variant === "icon") return <LogoIcon {...label} className={cn("aspect-square h-8 w-auto", colorClass, className)} />
  if (variant === "lettering") return <LogoLettering {...label} className={cn("aspect-[2524/131] h-3 w-auto", colorClass, className)} />
  if (variant === "gradient")
    return (
      <span {...label} className={cn("inline-flex h-8", className)}>
        <GradientIcon size={imageSize} priority={priority} />
      </span>
    )
  if (variant === "full" && layout === "stacked") return <LogoFull {...label} className={cn("aspect-[2524/1730] h-16 w-auto", colorClass, className)} />

  const icon = variant === "full" ? <LogoIcon aria-hidden className="aspect-square h-full w-auto" /> : <GradientIcon size={imageSize} priority={priority} />

  // Letras al lado del ícono, en una cuarta parte de su altura.
  if (layout === "inline")
    return (
      <span {...label} className={cn("inline-flex h-8 items-center gap-[0.6em]", colorClass, className)}>
        {icon}
        <LogoLettering aria-hidden className="aspect-[2524/131] h-[22%] w-auto" />
      </span>
    )

  // Apilado como el logo completo: el ícono ocupa el 58% del ancho y las letras van abajo.
  return (
    <span {...label} className={cn("inline-flex aspect-[2524/1730] h-16 flex-col items-center justify-between", colorClass, className)}>
      <span className="flex h-[84.6%] justify-center">{icon}</span>
      <LogoLettering aria-hidden className="aspect-[2524/131] h-[7.6%] w-auto" />
    </span>
  )
}

export default Logo

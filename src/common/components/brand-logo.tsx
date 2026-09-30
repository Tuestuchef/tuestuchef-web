import Image from "next/image"

import { brandConfig } from "@/common/lib/config/brand.config"
import { cn } from "@/common/lib/utils"

type BrandLogoProps = {
  variant?: "full" | "icon"
  className?: string
  priority?: boolean
}

// Único punto de entrada al logo. Nadie importa imágenes de logo directamente.
const BrandLogo = ({ variant = "full", className, priority }: BrandLogoProps) => {
  const { logo, name, monogram } = brandConfig

  if (!logo.ready) {
    return (
      <span
        className={cn("inline-flex items-center gap-2", className)}
        aria-label={name}
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted font-heading text-xs font-bold tracking-tight text-foreground"
        >
          {monogram}
        </span>
        {variant === "full" && (
          <span className="truncate font-heading text-sm font-semibold tracking-tight">
            {name}
          </span>
        )}
      </span>
    )
  }

  const source = variant === "full" ? logo.full : logo.icon

  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src={source.light}
        alt={name}
        priority={priority}
        className="h-8 w-auto dark:hidden"
      />
      <Image
        src={source.dark}
        alt={name}
        priority={priority}
        className="hidden h-8 w-auto dark:block"
      />
    </span>
  )
}

export default BrandLogo

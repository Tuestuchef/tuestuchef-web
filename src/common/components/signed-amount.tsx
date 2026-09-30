import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { cn } from "@/common/lib/utils"
import { formatUsdt } from "@/common/lib/utils/format-money.util"

type SignedAmountProps = {
  value: number
  // "result": verde si es positivo, rojo si es negativo (utilidad, saldo).
  // "income" / "expense": siempre verde o rojo, sin importar el signo.
  tone?: "result" | "income" | "expense"
  className?: string
  iconClassName?: string
}

// Monto en USDT con color, signo y flecha: se entiende también sin color.
const SignedAmount = ({ value, tone = "result", className, iconClassName }: SignedAmountProps) => {
  const positive = tone === "income" || (tone === "result" && value > 0)
  const negative = tone === "expense" || (tone === "result" && value < 0)
  const Icon = positive ? TrendingUpIcon : negative ? TrendingDownIcon : MinusIcon

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 tabular-nums",
        positive && "text-positive",
        negative && "text-negative",
        className
      )}
    >
      <Icon className={cn("size-4 shrink-0", iconClassName)} aria-hidden />
      {formatUsdt(tone === "result" ? value : Math.abs(value), { signed: tone === "result" })}
      <span className="sr-only">{positive ? "(a favor)" : negative ? "(en contra)" : ""}</span>
    </span>
  )
}

export default SignedAmount

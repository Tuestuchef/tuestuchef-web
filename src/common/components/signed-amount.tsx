import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import type { Currency } from "@/common/lib/constants/currency.constants"
import { cn } from "@/common/lib/utils"
import { formatMoney } from "@/common/lib/utils/format-money.util"

type SignedAmountProps = {
  value: number
  // Moneda del monto (por defecto, valor real en USDT).
  currency?: Currency
  // "result": verde si es positivo, rojo si es negativo (utilidad, movimientos).
  // "income" / "expense": siempre verde o rojo (cobros, pagos), con su signo.
  tone?: "result" | "income" | "expense"
  className?: string
  iconClassName?: string
}

// Dinero que entra o sale: color, signo y flecha, así se entiende también sin color.
// Verde y rojo son solo para esto (ver globals.css); totales y saldos van en el color del texto.
const SignedAmount = ({ value, currency = "USDT", tone = "result", className, iconClassName }: SignedAmountProps) => {
  const positive = tone === "income" || (tone === "result" && value > 0)
  const negative = tone === "expense" || (tone === "result" && value < 0)
  const Icon = positive ? TrendingUpIcon : negative ? TrendingDownIcon : MinusIcon
  const signedValue = tone === "income" ? Math.abs(value) : tone === "expense" ? -Math.abs(value) : value

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
      {formatMoney(signedValue, currency, { signed: true })}
      <span className="sr-only">{positive ? "(a favor)" : negative ? "(en contra)" : ""}</span>
    </span>
  )
}

export default SignedAmount

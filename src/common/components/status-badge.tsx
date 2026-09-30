import { Badge } from "@/common/components/ui/badge"
import {
  STATUS_TONES,
  type StatusTone,
} from "@/common/lib/constants/status.constants"
import { cn } from "@/common/lib/utils"

type StatusBadgeProps = {
  tone: StatusTone
  children?: React.ReactNode
  className?: string
}

const StatusBadge = ({ tone, children, className }: StatusBadgeProps) => {
  const { icon: Icon, label, className: toneClassName } = STATUS_TONES[tone]

  return (
    <Badge variant="outline" className={cn(toneClassName, className)}>
      <Icon aria-hidden />
      {children ?? label}
    </Badge>
  )
}

export default StatusBadge

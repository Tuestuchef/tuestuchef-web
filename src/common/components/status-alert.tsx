import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/common/components/ui/alert"
import {
  STATUS_TONES,
  type StatusTone,
} from "@/common/lib/constants/status.constants"
import { cn } from "@/common/lib/utils"

type StatusAlertProps = {
  tone: StatusTone
  title?: string
  children?: React.ReactNode
  className?: string
}

const StatusAlert = ({ tone, title, children, className }: StatusAlertProps) => {
  const { icon: Icon, label, className: toneClassName } = STATUS_TONES[tone]

  return (
    <Alert className={cn(toneClassName, className)}>
      <Icon aria-hidden />
      <AlertTitle>{title ?? label}</AlertTitle>
      {children && <AlertDescription>{children}</AlertDescription>}
    </Alert>
  )
}

export default StatusAlert

import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  type LucideIcon,
} from "lucide-react"

export type StatusTone = "success" | "warning" | "error" | "info"

// Cada estado se distingue por icono y texto, nunca solo por color.
export const STATUS_TONES: Record<
  StatusTone,
  { icon: LucideIcon; label: string; className: string }
> = {
  success: {
    icon: CircleCheckIcon,
    label: "Éxito",
    className: "bg-success text-success-foreground",
  },
  warning: {
    icon: CircleAlertIcon,
    label: "Advertencia",
    className: "bg-warning text-warning-foreground",
  },
  error: {
    icon: CircleXIcon,
    label: "Error",
    className: "bg-background text-destructive border-destructive",
  },
  info: {
    icon: InfoIcon,
    label: "Información",
    className: "bg-info text-info-foreground",
  },
}

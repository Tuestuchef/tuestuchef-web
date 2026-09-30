import type { HelpTopicKey } from "@/common/lib/constants/help.constants"
import { cn } from "@/common/lib/utils"

import PageHelp from "./page-help"

type PageHeaderProps = {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  // Ayuda de la pantalla (botón "?" junto al título).
  help?: HelpTopicKey
  className?: string
}

const PageHeader = ({ title, description, actions, help, className }: PageHeaderProps) => (
  <div className={cn("flex flex-wrap items-end justify-between gap-3 pt-2", className)}>
    <div className="grid gap-1">
      <div className="flex items-center gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {help && <PageHelp topic={help} />}
      </div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
)

export default PageHeader

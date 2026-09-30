import { cn } from "@/common/lib/utils"

type PageHeaderProps = {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

const PageHeader = ({ title, description, actions, className }: PageHeaderProps) => (
  <div className={cn("flex flex-wrap items-end justify-between gap-3 pt-2", className)}>
    <div className="grid gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
)

export default PageHeader

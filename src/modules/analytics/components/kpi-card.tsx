import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import { cn } from "@/common/lib/utils"

type KpiCardProps = {
  title: string
  value: React.ReactNode
  hint?: React.ReactNode
  className?: string
}

const KpiCard = ({ title, value, hint, className }: KpiCardProps) => (
  <Card className={cn("gap-2", className)}>
    <CardHeader>
      <CardDescription>{title}</CardDescription>
      <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle>
    </CardHeader>
    {hint && <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>}
  </Card>
)

export default KpiCard

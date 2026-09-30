"use client"

import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/common/components/ui/chart"
import { formatUsdt } from "@/common/lib/utils/format-money.util"

import type { MonthPoint } from "../lib/types/analytics.types"

// Verde = ingresos, rojo = egresos; la utilidad es una línea con puntos (se distingue por forma).
const chartConfig = {
  income: { label: "Ingresos", color: "var(--positive)" },
  expenses: { label: "Egresos", color: "var(--negative)" },
  profit: { label: "Utilidad", color: "var(--foreground)" },
} satisfies ChartConfig

const compact = new Intl.NumberFormat("es-VE", { notation: "compact", maximumFractionDigits: 1 })

const IncomeExpenseChart = ({ data }: { data: MonthPoint[] }) => (
  <Card>
    <CardHeader>
      <CardTitle>Ingresos, egresos y utilidad</CardTitle>
      <CardDescription>Últimos 12 meses, en USDT</CardDescription>
    </CardHeader>
    <CardContent className="px-2 sm:px-6">
      <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
        <ComposedChart data={data} margin={{ left: 4, right: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(value: number) => compact.format(value)}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <div className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">
                      {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                    </span>
                    <span className="font-mono tabular-nums">{formatUsdt(Number(value))}</span>
                  </div>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Line
            dataKey="profit"
            type="monotone"
            stroke="var(--color-profit)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ChartContainer>
    </CardContent>
  </Card>
)

export default IncomeExpenseChart

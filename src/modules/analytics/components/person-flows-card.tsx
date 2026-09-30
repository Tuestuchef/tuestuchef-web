import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import { formatUsdt } from "@/common/lib/utils/format-money.util"

import type { PersonFlows } from "../lib/types/analytics.types"

const COLUMNS: { key: keyof Omit<PersonFlows, "person">; label: string }[] = [
  { key: "salaries", label: "Sueldos" },
  { key: "withdrawals", label: "Retiros y adelantos" },
  { key: "distributions", label: "Reparto" },
  { key: "contributions", label: "Aportes" },
]

// "El Pulpo": cuánto dinero salió hacia (o entró desde) cada persona.
const PersonFlowsCard = ({ people }: { people: PersonFlows[] }) => (
  <Card>
    <CardHeader>
      <CardTitle>Negocio y personas</CardTitle>
      <CardDescription>
        Lo que cada persona recibió (sueldos, retiros, reparto) o aportó, en USDT. Así se ve el Pulpo.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin sueldos, retiros, repartos ni aportes en este período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Persona</th>
                {COLUMNS.map((column) => (
                  <th key={column.key} className="px-3 py-2 text-right font-medium">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.person} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{person.person}</td>
                  {COLUMNS.map((column) => (
                    <td key={column.key} className="px-3 py-2 text-right tabular-nums">
                      {person[column.key] ? formatUsdt(person[column.key]) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CardContent>
  </Card>
)

export default PersonFlowsCard

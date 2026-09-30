"use client"

import { useId, useState } from "react"

import { Label } from "@/common/components/ui/label"
import { Switch } from "@/common/components/ui/switch"

type ActiveSwitchFieldProps = {
  defaultChecked: boolean
  name?: string
  label?: string
  description?: string
}

// Interruptor "activo" que viaja en el formulario como "true"/"false".
const ActiveSwitchField = ({
  defaultChecked,
  name = "is_active",
  label = "Activo",
  description,
}: ActiveSwitchFieldProps) => {
  const id = useId()
  const [checked, setChecked] = useState(defaultChecked)

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="grid gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={setChecked} />
      <input type="hidden" name={name} value={String(checked)} />
    </div>
  )
}

export default ActiveSwitchField

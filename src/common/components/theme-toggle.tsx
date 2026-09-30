"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/common/components/ui/dropdown-menu"

const THEME_OPTIONS = [
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "dark", label: "Oscuro", icon: MoonIcon },
  { value: "system", label: "Sistema", icon: MonitorIcon },
] as const

// Submenú de tema para usar dentro de un DropdownMenu.
const ThemeToggle = () => {
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <SunIcon className="dark:hidden" />
        <MoonIcon className="hidden dark:block" />
        Tema
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

export default ThemeToggle

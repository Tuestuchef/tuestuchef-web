"use client"

import { Toaster } from "@/common/components/ui/sonner"
import { TooltipProvider } from "@/common/components/ui/tooltip"
import { QueryProvider } from "@/common/lib/providers/query.provider"
import { ThemeProvider } from "@/common/lib/providers/theme.provider"

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <TooltipProvider>
          {children}
          <Toaster position="top-center" richColors={false} />
        </TooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  )
}

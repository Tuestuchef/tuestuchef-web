"use client"

import { Drawer as DrawerPrimitive } from "vaul"

import { DrawerOverlay, DrawerPortal } from "@/common/components/ui/drawer"
import { cn } from "@/common/lib/utils"

// Panel lateral flotante: separado de los bordes, con esquinas redondeadas.
// Se usa dentro de <Drawer direction="right"> (de ui/drawer); se cierra deslizando hacia la derecha.
const SideDrawerContent = ({ className, children, ...props }: React.ComponentProps<typeof DrawerPrimitive.Content>) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      data-slot="drawer-content"
      className={cn(
        "fixed inset-y-2 right-2 z-50 flex w-[calc(100%-1rem)] flex-col overflow-hidden rounded-2xl border bg-popover text-sm text-popover-foreground shadow-lg outline-none sm:max-w-md",
        className
      )}
      // vaul ajusta el desplazamiento al arrastrar; el margen hace que se vea "flotando".
      style={{ "--initial-transform": "calc(100% + 8px)" } as React.CSSProperties}
      {...props}
    >
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
)

export default SideDrawerContent

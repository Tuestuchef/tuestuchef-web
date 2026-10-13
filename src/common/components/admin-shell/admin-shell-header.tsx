import Logo from "@/common/components/logo/logo"
import { Separator } from "@/common/components/ui/separator"
import { SidebarTrigger } from "@/common/components/ui/sidebar"
import { cn } from "@/common/lib/utils"

// Modo simple: en el celular no hay menú lateral (están las pestañas abajo), así que no va su botón.
const AdminShellHeader = ({ simple = false }: { simple?: boolean }) => (
  <header className="print:hidden sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 rounded-t-[inherit] border-b bg-background/95 px-4 backdrop-blur transition-[width,height] ease-linear supports-[backdrop-filter]:bg-background/80 lg:px-6">
    <SidebarTrigger className={cn("-ml-1 size-9 md:size-7", simple && "max-md:hidden")} />
    <Separator
      orientation="vertical"
      className={cn("mx-2 data-vertical:h-4 data-vertical:self-auto md:hidden", simple && "hidden")}
    />
    {/* En el celular el sidebar está oculto: la marca va en la barra superior. */}
    <Logo variant="gradient-full" layout="inline" className="h-7 md:hidden" />
  </header>
)

export default AdminShellHeader

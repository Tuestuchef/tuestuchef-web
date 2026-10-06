import Logo from "@/common/components/logo/logo"
import { Separator } from "@/common/components/ui/separator"
import { SidebarTrigger } from "@/common/components/ui/sidebar"

const AdminShellHeader = () => (
  <header className="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 rounded-t-[inherit] border-b bg-background/95 px-4 backdrop-blur transition-[width,height] ease-linear supports-[backdrop-filter]:bg-background/80 lg:px-6">
    <SidebarTrigger className="-ml-1 size-9 md:size-7" />
    <Separator
      orientation="vertical"
      className="mx-2 data-vertical:h-4 data-vertical:self-auto md:hidden"
    />
    {/* En el celular el sidebar está oculto: la marca va en la barra superior. */}
    <Logo variant="gradient-full" layout="inline" className="h-7 md:hidden" />
  </header>
)

export default AdminShellHeader

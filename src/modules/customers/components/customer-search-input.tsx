"use client"

import { SearchIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { Input } from "@/common/components/ui/input"

// Búsqueda en la URL (?q=), para que el resultado se pueda compartir y recargar.
const CustomerSearchInput = () => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("q") ?? "")

  useEffect(() => {
    if (search === (searchParams.get("q") ?? "")) return
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams)
      if (search.trim()) params.set("q", search.trim())
      else params.delete("q")
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reacciona al texto
  }, [search])

  return (
    <div className="relative">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Nombre, teléfono, correo o Instagram"
        aria-label="Buscar cliente"
        className="h-11 pl-9 md:h-9"
      />
    </div>
  )
}

export default CustomerSearchInput

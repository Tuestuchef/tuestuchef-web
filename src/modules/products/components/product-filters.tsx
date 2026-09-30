"use client"

import { SearchIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { Input } from "@/common/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/common/components/ui/select"

import type { CatalogItem } from "../lib/types/products.types"

const ALL = "all"

const ProductFilters = ({ categories }: { categories: CatalogItem[] }) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("q") ?? "")

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams)
    if (!value || value === ALL) params.delete(key)
    else params.set(key, value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // Busca al dejar de escribir.
  useEffect(() => {
    const current = searchParams.get("q") ?? ""
    if (search === current) return
    const timer = setTimeout(() => setParam("q", search.trim()), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reacciona al texto
  }, [search])

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_14rem]">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto"
          aria-label="Buscar producto"
          className="h-11 pl-9 md:h-9"
        />
      </div>
      <Select value={searchParams.get("categoria") ?? ALL} onValueChange={(value) => setParam("categoria", value)}>
        <SelectTrigger aria-label="Categoría" className="h-11 w-full md:h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas las categorías</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default ProductFilters

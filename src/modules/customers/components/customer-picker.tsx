"use client"

import { ChevronsUpDownIcon, Loader2Icon, UserPlusIcon, UserRoundIcon, XIcon } from "lucide-react"
import { useEffect, useState, useTransition } from "react"

import { Button } from "@/common/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/common/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/common/components/ui/popover"

import { searchCustomersAction } from "../lib/actions/search-customers.action"
import type { CustomerListItem } from "../lib/types/customers.types"
import { formatPhone } from "../lib/utils/normalize-contact.util"
import CustomerFormDialog from "./customer-form-dialog"

export type PickedCustomer = { id: string; name: string }

type CustomerPickerProps = {
  value: PickedCustomer | null
  onChange: (customer: PickedCustomer | null) => void
  canManage: boolean
  emptyLabel?: string
}

const displayName = (c: CustomerListItem) => [c.first_name, c.last_name].filter(Boolean).join(" ")

// Buscar o crear un cliente sin salir de la pantalla. Vacío = sin cliente.
const CustomerPicker = ({ value, onChange, canManage, emptyLabel = "Sin cliente" }: CustomerPickerProps) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<CustomerListItem[]>([])
  const [loading, startLoading] = useTransition()

  useEffect(() => {
    const term = search.trim()
    if (term.length < 2) return
    const timer = setTimeout(() => startLoading(async () => setResults(await searchCustomersAction(term))), 250)
    return () => clearTimeout(timer)
  }, [search])

  const shown = search.trim().length < 2 ? [] : results

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-11 min-w-0 flex-1 justify-between font-normal md:h-9"
          >
            <span className="flex min-w-0 items-center gap-2">
              <UserRoundIcon className="shrink-0 opacity-60" aria-hidden />
              <span className={value ? "truncate" : "truncate text-muted-foreground"}>{value?.name ?? emptyLabel}</span>
            </span>
            <ChevronsUpDownIcon className="shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
          {/* La búsqueda la hace el servidor: el filtro local se apaga. */}
          <Command shouldFilter={false}>
            <CommandInput value={search} onValueChange={setSearch} placeholder="Nombre, teléfono, correo o @" />
            <CommandList>
              {loading && (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                  Buscando…
                </div>
              )}
              {!loading && (
                <CommandEmpty>
                  {search.trim().length < 2 ? "Escribe al menos 2 letras." : "No hay coincidencias."}
                </CommandEmpty>
              )}
              <CommandGroup>
                {shown.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={() => {
                      onChange({ id: customer.id, name: displayName(customer) })
                      setOpen(false)
                      setSearch("")
                    }}
                  >
                    <span className="grid min-w-0">
                      <span className="truncate">{displayName(customer)}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {customer.phone ? formatPhone(customer.phone) : (customer.email ?? `@${customer.instagram}`)}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 md:size-9"
          onClick={() => onChange(null)}
        >
          <XIcon aria-hidden />
          <span className="sr-only">Quitar cliente</span>
        </Button>
      ) : (
        <CustomerFormDialog
          canManage={canManage}
          onSaved={onChange}
          trigger={
            <Button type="button" variant="outline" size="icon" className="size-11 md:size-9">
              <UserPlusIcon aria-hidden />
              <span className="sr-only">Nuevo cliente</span>
            </Button>
          }
        />
      )}
    </div>
  )
}

export default CustomerPicker

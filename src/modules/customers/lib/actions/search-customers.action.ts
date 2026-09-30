"use server"

import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"

import { listCustomers } from "../services/customers.service"
import type { CustomerListItem } from "../types/customers.types"

// Buscador de clientes para otras pantallas (p. ej. registrar una venta).
export async function searchCustomersAction(search: string): Promise<CustomerListItem[]> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return []
  const parsed = z.string().trim().max(80).safeParse(search)
  if (!parsed.success || parsed.data.length < 2) return []
  const customers = await listCustomers({ search: parsed.data })
  return customers.filter((c) => c.is_active).slice(0, 10)
}

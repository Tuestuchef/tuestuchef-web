import type { PostgrestError } from "@supabase/supabase-js"

// La API de Supabase devuelve como máximo 1.000 filas por consulta. Para listas que pueden pasar
// de eso (variantes, saldos de stock), se piden por páginas hasta traer todas.
// page(from, to) debe armar la consulta de nuevo, con un orden estable y .range(from, to).
const PAGE = 1000

export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) return { data: rows, error }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return { data: rows, error: null }
  }
}

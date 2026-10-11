// Búsqueda rápida en listas largas (miles de variantes): sin acentos ni mayúsculas, y cada palabra
// escrita debe aparecer en el texto, en cualquier orden ("filipina dama negra 3xl").
export const normalizeSearch = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

export const searchTerms = (query: string) => normalizeSearch(query).split(/\s+/).filter(Boolean)

// haystack ya normalizado (calcularlo una vez con normalizeSearch, no en cada tecla).
export const matchesTerms = (haystack: string, terms: string[]) => terms.every((term) => haystack.includes(term))

// Filtra y corta: en pantalla solo los primeros `limit` (el resto se encuentra afinando la búsqueda).
export function searchList<T>(items: { item: T; haystack: string }[], query: string, limit: number) {
  const terms = searchTerms(query)
  const matches: T[] = []
  let total = 0
  for (const entry of items) {
    if (terms.length === 0 || matchesTerms(entry.haystack, terms)) {
      total += 1
      if (matches.length < limit) matches.push(entry.item)
    }
  }
  return { matches, total }
}

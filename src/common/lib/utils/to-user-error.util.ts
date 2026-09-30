type DbError = { code?: string; message?: string } | null | undefined

const PERMISSION_MESSAGE = "No tienes permiso para hacer esto."

// Traduce un error de Supabase/Postgres a un mensaje para la persona.
// Las reglas del negocio ya lanzan mensajes en español (código P0001 o 23001).
export function toUserError(error: DbError, fallback = "No se pudo guardar. Intenta de nuevo."): string {
  if (!error) return fallback
  const message = error.message ?? ""

  switch (error.code) {
    case "P0001":
    case "23001":
      return message || fallback
    case "42501":
      return PERMISSION_MESSAGE
    case "23505":
      return "Ya existe un registro con ese nombre."
    case "23514":
      return "Algún dato no es válido. Revisa el formulario."
    case "23503":
      return "Uno de los datos seleccionados ya no existe."
  }

  if (/row-level security|permission denied/i.test(message)) return PERMISSION_MESSAGE
  return fallback
}

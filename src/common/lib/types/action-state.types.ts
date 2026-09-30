// Respuesta estándar de las server actions de formularios.
export type ActionState<TField extends string = string> = {
  status: "idle" | "success" | "error"
  message?: string
  fieldErrors?: Partial<Record<TField, string[]>>
  // Cambia en cada éxito: sirve de key para reiniciar el formulario.
  submissionId?: string
}

export const IDLE_ACTION_STATE: ActionState = { status: "idle" }

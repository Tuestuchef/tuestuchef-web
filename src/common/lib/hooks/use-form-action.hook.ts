"use client"

import { type FormEvent, startTransition, useActionState } from "react"

import { type ActionState, IDLE_ACTION_STATE } from "@/common/lib/types/action-state.types"

// Envía el formulario a una server action sin el reinicio automático de React 19
// (que borraría lo escrito aunque la acción devuelva un error).
// Para limpiar tras un éxito, usa state.submissionId como key del formulario.
// TState puede extender ActionState con datos propios (p. ej. un duplicado encontrado).
export function useFormAction<TState extends ActionState<string>>(
  action: (prev: TState, formData: FormData) => Promise<TState>,
  initialState: TState = IDLE_ACTION_STATE as TState
) {
  const [state, dispatch, pending] = useActionState<TState, FormData>(action, initialState as Awaited<TState>)

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => dispatch(formData))
  }

  return { state, onSubmit, pending }
}

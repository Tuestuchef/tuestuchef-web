"use client"

import { type FormEvent, startTransition, useActionState } from "react"

import { type ActionState, IDLE_ACTION_STATE } from "@/common/lib/types/action-state.types"

// Envía el formulario a una server action sin el reinicio automático de React 19
// (que borraría lo escrito aunque la acción devuelva un error).
// Para limpiar tras un éxito, usa state.submissionId como key del formulario.
export function useFormAction<TField extends string>(
  action: (prev: ActionState<TField>, formData: FormData) => Promise<ActionState<TField>>,
  initialState: ActionState<TField> = IDLE_ACTION_STATE
) {
  const [state, dispatch, pending] = useActionState(action, initialState)

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => dispatch(formData))
  }

  return { state, onSubmit, pending }
}

"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import type { ActionState } from "@/common/lib/types/action-state.types"

// Muestra el aviso de éxito una sola vez por envío y avisa al componente.
export function useActionFeedback(
  state: ActionState,
  onSuccess?: () => void,
  { showToast = true }: { showToast?: boolean } = {}
) {
  const lastSubmission = useRef<string | undefined>(undefined)
  const onSuccessRef = useRef(onSuccess)

  useEffect(() => {
    onSuccessRef.current = onSuccess
  })

  useEffect(() => {
    if (state.status !== "success" || state.submissionId === lastSubmission.current) return
    lastSubmission.current = state.submissionId
    if (showToast && state.message) toast.success(state.message)
    onSuccessRef.current?.()
  }, [state, showToast])
}

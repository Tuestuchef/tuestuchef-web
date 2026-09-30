export const USER_MESSAGES = {
  INVITED: "Invitación enviada.",
  ROLE_CHANGED: "Rol actualizado.",
  ACTIVATED: "Usuario activado.",
  DEACTIVATED: "Usuario desactivado.",
  INVITES_DISABLED:
    "Las invitaciones no están disponibles: falta configurar SUPABASE_SECRET_KEY en el servidor.",
  ALREADY_EXISTS: "Ya existe un usuario con ese correo.",
  INVITE_FAILED: "No se pudo enviar la invitación. Intenta de nuevo.",
  NOT_FOUND: "El usuario no existe o no tienes acceso a él.",
  LINK_INVALID: "El enlace no es válido o ya venció. Pide que te inviten de nuevo.",
} as const

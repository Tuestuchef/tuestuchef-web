// Crea el PRIMER owner del sistema. Se niega si ya existe un owner activo:
// los siguientes owners se asignan desde /configuracion/usuarios.
//
// Uso (lee .env.local; necesita NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY):
//   npm run create-first-owner -- --email dueno@tuestuchef.com --name "Nombre Apellido"
//
// No hay contraseñas: después entras en /login con ese correo, recibes un código y el
// panel te pide activar la app autenticadora (2FA obligatorio para owner).
import { parseArgs } from "node:util"

import { createClient } from "@supabase/supabase-js"

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
  },
})

const fail = (message) => {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

if (!url || !secretKey) fail("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local.")
if (!values.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) fail("Indica --email con un correo válido.")
if (!values.name || values.name.trim().length < 2) fail('Indica --name "Nombre Apellido".')

const email = values.email.trim().toLowerCase()
const fullName = values.name.trim()
const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

const { data: owners, error: ownersError } = await supabase
  .from("profiles")
  .select("id")
  .eq("role", "owner")
  .eq("is_active", true)
  .limit(1)

if (ownersError) fail(`No se pudo consultar la base: ${ownersError.message}`)
if (owners.length > 0) fail("Ya existe un owner activo. Asigna nuevos owners desde /configuracion/usuarios.")

// Usuario confirmado y sin contraseña: entra con código por correo.
const { data, error } = await supabase.auth.admin.createUser({
  email,
  email_confirm: true,
  user_metadata: { full_name: fullName },
})
if (error) fail(`No se pudo crear el usuario: ${error.message}`)

// Sin sesión (clave secreta): queda en role_changes como hecho por el sistema.
const { error: roleError } = await supabase.from("profiles").update({ role: "owner" }).eq("id", data.user.id)
if (roleError) fail(`El usuario se creó pero no se pudo asignar el rol owner: ${roleError.message}`)

console.log(`\n✓ Owner creado: ${fullName} <${email}>`)
console.log(`  Entra en ${siteUrl}/login con ese correo. Te llegará un código y luego`)
console.log(`  activarás la app autenticadora (Google Authenticator, 1Password…).\n`)

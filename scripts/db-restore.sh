#!/usr/bin/env bash
# Restaura un respaldo de scripts/db-backup.sh en una base de Postgres VACÍA (un proyecto de
# Supabase nuevo). Nunca sobre producción en uso. Ver docs/puesta-en-marcha.md, sección 7.
#
# Uso:
#   BACKUP_PASSPHRASE=... TARGET_DB_URL=... CONFIRM_RESTORE=<ref del proyecto destino> \
#     scripts/db-restore.sh tuestuchef-AAAA-MM-DDTHHMMZ.tar.gz.gpg
#
# Requiere gpg, tar y psql. CONFIRM_RESTORE debe ser el ref del proyecto que aparece en
# TARGET_DB_URL, para no restaurar por error en el proyecto equivocado.
set -euo pipefail

ARCHIVE="${1:?Indica el archivo .tar.gz.gpg}"
: "${BACKUP_PASSPHRASE:?Falta BACKUP_PASSPHRASE}"
: "${TARGET_DB_URL:?Falta TARGET_DB_URL}"
: "${CONFIRM_RESTORE:?Falta CONFIRM_RESTORE (ref del proyecto destino)}"

if [[ "$TARGET_DB_URL" != *"$CONFIRM_RESTORE"* ]]; then
  echo "CONFIRM_RESTORE ($CONFIRM_RESTORE) no aparece en TARGET_DB_URL. No se restaura." >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

gpg --batch --pinentry-mode loopback --decrypt --passphrase-fd 3 "$ARCHIVE" 3<<<"$BACKUP_PASSPHRASE" | tar -C "$WORK" -xzf -
DUMP="$(find "$WORK" -mindepth 1 -maxdepth 1 -type d | head -n1)"

# Igual que la guía de Supabase: todo en una transacción y sin disparar triggers al cargar datos
# (los de inmutabilidad bloquearían la carga).
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file "$DUMP/roles.sql" \
  --file "$DUMP/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$DUMP/data.sql" \
  --dbname "$TARGET_DB_URL"

echo "Restaurado en $CONFIRM_RESTORE desde $(basename "$ARCHIVE")."

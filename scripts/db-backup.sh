#!/usr/bin/env bash
# Respaldo de la base de datos de Supabase a Cloudflare R2, cifrado. Lo corre GitHub Actions cada
# noche (.github/workflows/db-backup.yml); ver docs/puesta-en-marcha.md, sección 7.
#
# 1. Vuelca roles, esquema y datos con `supabase db dump` (incluye los usuarios de auth).
# 2. Comprime y cifra con una frase de paso (AES-256): el respaldo tiene datos personales.
# 3. Lo sube al bucket de respaldos y borra los de más de RETENTION_DAYS días.
#
# Variables: SUPABASE_DB_URL, BACKUP_PASSPHRASE, R2_ACCOUNT_ID, R2_BUCKET,
#            AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY (token de R2), RETENTION_DAYS (30).
set -euo pipefail

: "${SUPABASE_DB_URL:?Falta SUPABASE_DB_URL}"
: "${BACKUP_PASSPHRASE:?Falta BACKUP_PASSPHRASE}"
: "${R2_ACCOUNT_ID:?Falta R2_ACCOUNT_ID}"
: "${R2_BUCKET:?Falta R2_BUCKET}"
: "${AWS_ACCESS_KEY_ID:?Falta AWS_ACCESS_KEY_ID}"
: "${AWS_SECRET_ACCESS_KEY:?Falta AWS_SECRET_ACCESS_KEY}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# R2 habla S3; región "auto" y sin los checksums nuevos del CLI de AWS que R2 no exige.
export AWS_DEFAULT_REGION=auto
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

STAMP="$(date -u +%Y-%m-%dT%H%MZ)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
DUMP="$WORK/tuestuchef-$STAMP"
mkdir -p "$DUMP"

echo "Volcando la base…"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$DUMP/roles.sql" --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$DUMP/schema.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$DUMP/data.sql" --use-copy --data-only

# Un respaldo sin tablas o sin usuarios no sirve para restaurar: mejor fallar y que avise.
grep -q 'CREATE TABLE "public"."sales"\|CREATE TABLE IF NOT EXISTS "public"."sales"' "$DUMP/schema.sql" || {
  echo "El esquema no tiene la tabla de ventas: respaldo incompleto." >&2
  exit 1
}
grep -q 'COPY "auth"."users"' "$DUMP/data.sql" || {
  echo "Los datos no incluyen los usuarios (auth.users): respaldo incompleto." >&2
  exit 1
}

ARCHIVE="$WORK/tuestuchef-$STAMP.tar.gz.gpg"
tar -C "$WORK" -czf - "tuestuchef-$STAMP" |
  gpg --batch --yes --pinentry-mode loopback --symmetric --cipher-algo AES256 --passphrase-fd 3 -o "$ARCHIVE" 3<<<"$BACKUP_PASSPHRASE"
SIZE="$(du -h "$ARCHIVE" | cut -f1)"
SHA="$(sha256sum "$ARCHIVE" | cut -d' ' -f1)"

KEY="daily/$(date -u +%Y/%m)/tuestuchef-$STAMP.tar.gz.gpg"
echo "Subiendo $KEY ($SIZE)…"
aws s3 cp "$ARCHIVE" "s3://$R2_BUCKET/$KEY" --endpoint-url "$ENDPOINT" --metadata "sha256=$SHA" --only-show-errors

# Retención: borra los respaldos más viejos que RETENTION_DAYS (además de la regla del bucket).
CUTOFF="$(date -u -d "$RETENTION_DAYS days ago" +%Y-%m-%dT%H:%M:%S)"
OLD="$(aws s3api list-objects-v2 --bucket "$R2_BUCKET" --prefix daily/ --endpoint-url "$ENDPOINT" \
  --query "Contents[?LastModified<'$CUTOFF'].Key" --output text)"
if [[ -n "$OLD" && "$OLD" != "None" ]]; then
  for old in $OLD; do
    echo "Borrando respaldo vencido: $old"
    aws s3 rm "s3://$R2_BUCKET/$old" --endpoint-url "$ENDPOINT" --only-show-errors
  done
fi

COUNT="$(aws s3api list-objects-v2 --bucket "$R2_BUCKET" --prefix daily/ --endpoint-url "$ENDPOINT" --query 'length(Contents)' --output text)"
echo "Listo: $KEY · $SIZE · sha256 $SHA · $COUNT respaldos guardados."
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "### Respaldo de la base"
    echo "- Archivo: \`$KEY\`"
    echo "- Tamaño: $SIZE"
    echo "- SHA-256: \`$SHA\`"
    echo "- Respaldos guardados: $COUNT (se borran a los $RETENTION_DAYS días)"
  } >>"$GITHUB_STEP_SUMMARY"
fi

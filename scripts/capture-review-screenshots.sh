#!/usr/bin/env bash
#
# Recapture the review screenshots, deterministically and safely.
#
#   1. builds the app and starts it in PRODUCTION mode (no Next dev overlay)
#   2. pins the server to the TEST database (refuses any non-"test" DB name)
#   3. seeds the golden-path fixture and emits the real internal route IDs
#   4. captures every screen and FAILS if any page is a 404 / missing the prototype
#      label / missing expected content (scripts/capture-review-screenshots.mjs)
#
# Fake data only. Usage: npm run screenshots:review
set -euo pipefail
cd "$(dirname "$0")/.."

# Read values straight from .env. NB: do NOT use `dotenv.config()` in a shell
# command-substitution — dotenv v17 prints an informational banner to stdout that would
# be captured INTO the value and corrupt the connection string.
read_env() { grep -E "^$1=" .env | head -1 | sed -E "s/^$1=//; s/^\"//; s/\"$//"; }
TESTDB=$(read_env TEST_DATABASE_URL)
SECRET=$(read_env AUTH_SECRET)
[ -n "$TESTDB" ] || { echo "TEST_DATABASE_URL not set in .env"; exit 1; }
[ -n "$SECRET" ] || { echo "AUTH_SECRET not set in .env"; exit 1; }
DBNAME=${TESTDB##*/}; DBNAME=${DBNAME%%\?*}
case "$DBNAME" in
  *test*) ;;
  *) echo "Refusing: database \"$DBNAME\" must contain \"test\"."; exit 1;;
esac

PORT="${PORT:-3000}"
WORK="$(mktemp -d)"
IDS_FILE="$WORK/ids.json"
SRVLOG="$WORK/server.log"

cleanup() { [ -n "${SRV:-}" ] && kill "$SRV" 2>/dev/null || true; }
trap cleanup EXIT

echo "== 1/4 build (production) =="
npm run build

echo "== 2/4 start production server on TEST db ($DBNAME), port $PORT =="
lsof -ti tcp:"$PORT" | xargs kill -9 2>/dev/null || true
DATABASE_URL="$TESTDB" AUTH_SECRET="$SECRET" AUTH_TRUST_HOST=true \
  AUTH_URL="http://localhost:$PORT" npx next start -p "$PORT" >"$SRVLOG" 2>&1 &
SRV=$!
for i in $(seq 1 60); do
  curl -sf -o /dev/null "http://localhost:$PORT/connexion" && { echo "ready (~${i}s)"; break; }
  sleep 1
  [ "$i" = 60 ] && { echo "server did not start"; cat "$SRVLOG"; exit 1; }
done

echo "== 3/4 seed deterministic review fixture =="
tsx scripts/seed-review-fixture.ts "$IDS_FILE"

# Mint a session token per demo user through the running server (credentials flow).
login_token() {
  local jar; jar="$(mktemp)"
  local csrf; csrf=$(curl -s -c "$jar" "http://localhost:$PORT/api/auth/csrf" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(JSON.parse(d).csrfToken))")
  curl -s -b "$jar" -c "$jar" -X POST "http://localhost:$PORT/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "csrfToken=$csrf" --data-urlencode "email=$1" \
    --data-urlencode "password=demo1234" --data-urlencode "callbackUrl=http://localhost:$PORT/" -o /dev/null
  grep "authjs.session-token" "$jar" | tail -1 | awk '{print $NF}'
}
ADMIN_T=$(login_token "awa.njoya@hrb-demo.cm")
RECEP_T=$(login_token "brigitte.mbarga@hrb-demo.cm")
DIR_T=$(login_token "emmanuel.tchoua@hrb-demo.cm")
[ -n "$ADMIN_T" ] || { echo "login failed (no session token)"; cat "$SRVLOG"; exit 1; }
SESS_FILE="$WORK/sessions.json"
node -e "require('fs').writeFileSync(process.argv[1],JSON.stringify({admin:process.argv[2],reception:process.argv[3],director:process.argv[4]}))" \
  "$SESS_FILE" "$ADMIN_T" "$RECEP_T" "$DIR_T"

echo "== 4/4 capture + validate screenshots =="
BASE_URL="http://localhost:$PORT" IDS_FILE="$IDS_FILE" SESSIONS_FILE="$SESS_FILE" \
  OUTDIR="docs/review-screenshots" node scripts/capture-review-screenshots.mjs

echo "== done — docs/review-screenshots/ =="

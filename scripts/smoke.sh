#!/usr/bin/env bash
# homelab-hub server smoke test — runs against a temp DATA_DIR; static checks need a built dist/.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT="${SMOKE_PORT:-8123}"
BASE="http://127.0.0.1:$PORT"
TMP_DATA="$(mktemp -d)"
FAILS=0
SERVER_PID=""

say()  { printf '%s\n' "$*"; }
pass() { say "  ok: $1"; }
fail() { say "  FAIL: $1"; FAILS=$((FAILS + 1)); }

cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  rm -rf "$TMP_DATA"
}
trap cleanup EXIT

say "[smoke] starting server on :$PORT (data: $TMP_DATA)"
DATA_DIR="$TMP_DATA" PORT="$PORT" node server/server.mjs > "$TMP_DATA/server.log" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 40); do
  curl -sf "$BASE/api/health" > /dev/null 2>&1 && break
  sleep 0.25
done
curl -sf "$BASE/api/health" > /dev/null || { say "server did not come up"; cat "$TMP_DATA/server.log"; exit 1; }

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

# 1. health
[ "$(code "$BASE/api/health")" = "200" ] && pass "health 200" || fail "health"

# 2. seeded data shape
curl -s "$BASE/api/data" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const j=JSON.parse(s);
  if(j.version!==1||!Array.isArray(j.links)||j.links.length<1||!Array.isArray(j.categories))process.exit(1);
});' && pass "data seeded + shape" || fail "data shape"

# 3. PUT round trip + disk persistence
curl -s "$BASE/api/data" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const j=JSON.parse(s); j.settings.title="smoke-test"; process.stdout.write(JSON.stringify(j));
});' > "$TMP_DATA/put.json"
[ "$(code -X PUT -H 'content-type: application/json' --data-binary @"$TMP_DATA/put.json" "$BASE/api/data")" = "200" ] && pass "PUT valid 200" || fail "PUT valid"
grep -q '"title": "smoke-test"' "$TMP_DATA/links.json" && pass "persisted to disk (atomic write)" || fail "disk persistence"

# 4. PUT invalid json -> 400
[ "$(code -X PUT -H 'content-type: application/json' --data 'not json' "$BASE/api/data")" = "400" ] && pass "invalid json 400" || fail "invalid json"

# 5. PUT wrong shape -> 400
[ "$(code -X PUT -H 'content-type: application/json' --data '{"version":1}' "$BASE/api/data")" = "400" ] && pass "wrong shape 400" || fail "wrong shape"

# 6. PUT oversized (>1MB) -> 413
node -e 'process.stdout.write("{\"pad\":\"" + "a".repeat(1100000) + "\"}")' > "$TMP_DATA/big.json"
[ "$(code -X PUT -H 'content-type: application/json' --data-binary @"$TMP_DATA/big.json" "$BASE/api/data")" = "413" ] && pass "oversized 413" || fail "oversized"

# 7. wrong content-type -> 415
[ "$(code -X PUT -H 'content-type: text/plain' --data 'x' "$BASE/api/data")" = "415" ] && pass "content-type 415" || fail "content-type"

# 8. static + SPA fallback (needs dist/)
if [ -d dist ]; then
  [ "$(code "$BASE/")" = "200" ] && pass "index 200" || fail "index"
  curl -sI "$BASE/" | grep -qi 'content-type: text/html' && pass "index content-type" || fail "index content-type"
  JS_FILE="$(ls dist/assets/*.js 2>/dev/null | head -1)"
  if [ -n "$JS_FILE" ]; then
    curl -sI "$BASE/assets/$(basename "$JS_FILE")" | grep -qi 'content-type: text/javascript' && pass "asset mime" || fail "asset mime"
  fi
  [ "$(code "$BASE/some/spa/route")" = "200" ] && pass "spa fallback" || fail "spa fallback"
else
  say "  (dist/ missing — static checks skipped)"
fi

# 9. unknown api route -> 404
[ "$(code "$BASE/api/nope")" = "404" ] && pass "api 404" || fail "api 404"

# 10. path traversal blocked
T="$(curl -s --path-as-is "$BASE/..%2f..%2f..%2fetc%2fpasswd")"
echo "$T" | grep -q 'root:' && fail "traversal leaked /etc/passwd" || pass "traversal blocked"

# 11. status sweep: self-ping online (with latency), closed port offline
node -e '
const fs=require("fs");
const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
j.links=[
 {id:"self",name:"Self",url:process.argv[2]+"/api/health",category:j.categories[0].id,icon:{type:"monogram"},checkEnabled:true},
 {id:"dead",name:"Dead",url:"http://127.0.0.1:1",category:j.categories[0].id,icon:{type:"monogram"},checkEnabled:true}
];
process.stdout.write(JSON.stringify(j));' "$TMP_DATA/put.json" "$BASE" > "$TMP_DATA/status.json"
[ "$(code -X PUT -H 'content-type: application/json' --data-binary @"$TMP_DATA/status.json" "$BASE/api/data")" = "200" ] || fail "PUT status dataset"
STATUS_OK=""
for _ in $(seq 1 40); do
  curl -s "$BASE/api/status" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const j=JSON.parse(s);
  const self=j.statuses.self, dead=j.statuses.dead;
  const ok = self && self.state==="online" && typeof self.latencyMs==="number" && dead && dead.state==="offline";
  process.exit(ok?0:1);
});' && { STATUS_OK=1; break; }
  sleep 0.5
done
[ -n "$STATUS_OK" ] && pass "sweep: self online + latency, dead offline" || { fail "status sweep"; curl -s "$BASE/api/status"; echo; }

# 12. graceful shutdown
kill -TERM "$SERVER_PID"
for _ in $(seq 1 12); do kill -0 "$SERVER_PID" 2>/dev/null || break; sleep 0.25; done
kill -0 "$SERVER_PID" 2>/dev/null && fail "SIGTERM shutdown" || pass "SIGTERM shutdown"
SERVER_PID=""

say ""
if [ "$FAILS" -gt 0 ]; then say "[smoke] $FAILS FAILURE(S)"; exit 1; fi
say "[smoke] all checks passed"

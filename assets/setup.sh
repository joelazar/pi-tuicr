#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO="${DEMO_DIR:-/tmp/pi-tuicr-demo}"

reviews="${HOME}/Library/Application Support/tuicr/reviews"
[ -d "$reviews" ] || reviews="${XDG_DATA_HOME:-$HOME/.local/share}/tuicr/reviews"
if [ -d "$reviews/sessions" ]; then
  rg -l --fixed-strings "$DEMO" "$reviews/sessions" | xargs rm -f || true
  if [ -f "$reviews/index.json" ]; then
    jq --arg demo "$DEMO" '.entries |= with_entries(.value |= map(select(.canonical_repo_path != $demo)) | select(.value | length > 0))' \
      "$reviews/index.json" > "$reviews/index.json.tmp" && mv "$reviews/index.json.tmp" "$reviews/index.json"
  fi
fi

rm -rf "$DEMO"
mkdir -p "$DEMO/src" "$DEMO/.pi/extensions"
ln -sf "$ROOT/index.ts" "$DEMO/.pi/extensions/pi-tuicr.ts"

cd "$DEMO"
git init -q
git config user.name "demo"
git config user.email "demo@example.com"

cat > src/auth.ts <<'EOF'
export function parseToken(header: string): string {
  return header.slice("Bearer ".length);
}
EOF

git add -A
git commit -qm "initial"

cat > src/auth.ts <<'EOF'
const CACHE = new Map<string, Session>();

export function parseToken(header: string): string {
  return header.slice("Bearer ".length);
}

export async function authenticate(header: string): Promise<Session> {
  const token = parseToken(header);
  const cached = CACHE.get(token);
  if (cached) return cached;

  const session = await fetchSession(token);
  CACHE.set(token, session);
  return session;
}
EOF

CONFIG="${DEMO}-config"
rm -rf "$CONFIG"
mkdir -p "$CONFIG/tuicr"
cat > "$CONFIG/tuicr/config.toml" <<'CFG'
theme = "catppuccin-mocha"
diff_view = "unified"
show_file_list = true
mouse = false
comment_vim = false
no_update_check = true

comment_types = [
  { id = "issue", color = "red", definition = "must be fixed before merge" },
  { id = "suggestion", color = "yellow", definition = "possible improvement" },
]
CFG

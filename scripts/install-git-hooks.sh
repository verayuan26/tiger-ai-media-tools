#!/usr/bin/env bash
# Install optional git hooks that print delivery reminders (non-blocking).
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo 'install-git-hooks: not inside a git repository' >&2; exit 1; }

HOOKS_DIR="$ROOT/.git/hooks"
CHECK_SCRIPT="$ROOT/scripts/check-delivery.sh"

mkdir -p "$HOOKS_DIR"

cat >"$HOOKS_DIR/pre-push" <<EOF
#!/usr/bin/env bash
set -euo pipefail
bash "$CHECK_SCRIPT" pre-push || true
EOF

chmod +x "$HOOKS_DIR/pre-push" "$CHECK_SCRIPT"

echo "Installed pre-push reminder hook at .git/hooks/pre-push"

#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

echo "→ typecheck"
npm run typecheck

echo "→ unit tests"
npm test

if git status --porcelain | grep -q '^'; then
  echo "✗ working tree is not clean — commit or stash before marking issue done"
  git status --short
  exit 1
fi

echo "✓ delivery checks passed (typecheck, tests, clean working tree)"

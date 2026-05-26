#!/usr/bin/env bash
# Delivery checks for Paperclip issue completion: staged commits, push, and frontend build.
set -euo pipefail

ISSUE_ID_PATTERN='[A-Z][A-Z0-9]+-[0-9]+'

usage() {
  cat <<'EOF'
Usage:
  scripts/check-delivery.sh before-done [--issue EGO-22]
  scripts/check-delivery.sh commit-msg "EGO-22: summary"
  scripts/check-delivery.sh pre-push

Commands:
  before-done   Fail if the working tree is dirty or commits are not pushed to upstream.
  commit-msg    Failures the commit message includes an issue identifier (e.g. EGO-22).
  pre-push      Reminder mode: print warnings before push (non-zero only on hard failures).
EOF
}

fail() {
  printf 'check-delivery: %s\n' "$1" >&2
  exit "${2:-1}"
}

warn() {
  printf 'check-delivery (warn): %s\n' "$1" >&2
}

require_git_repo() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail 'not inside a git repository'
}

assert_clean_worktree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    git status --short >&2
    fail 'working tree is not clean; commit or stash changes before marking the issue done'
  fi
}

assert_pushed() {
  local upstream
  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
  if [[ -z "$upstream" ]]; then
    warn 'no upstream branch configured; push manually and set upstream with git push -u'
    return 0
  fi

  local ahead
  ahead="$(git rev-list --count "${upstream}..HEAD" 2>/dev/null || echo 0)"
  if [[ "$ahead" != "0" ]]; then
    fail "${ahead} commit(s) not pushed to ${upstream}; run git push before marking the issue done"
  fi
}

assert_commit_msg() {
  local msg="${1:-}"
  [[ -n "$msg" ]] || fail 'commit message is required'

  if ! printf '%s' "$msg" | grep -Eq "${ISSUE_ID_PATTERN}"; then
    fail "commit message must include an issue identifier matching ${ISSUE_ID_PATTERN} (example: EGO-22: summary)"
  fi
}

assert_frontend_build_if_needed() {
  local base="${1:-HEAD~1}"
  if git diff --name-only "$base" HEAD -- 'src/client' | grep -q .; then
    if ! npm run build >/dev/null 2>&1; then
      fail 'src/client changed but npm run build failed; fix the build before delivery'
    fi
    printf 'check-delivery: npm run build passed for src/client changes\n'
  fi
}

cmd_before_done() {
  local issue_id=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --issue)
        issue_id="${2:-}"
        shift 2
        ;;
      *)
        fail "unknown argument: $1"
        ;;
    esac
  done

  require_git_repo
  assert_clean_worktree
  assert_pushed

  if [[ -n "$issue_id" ]]; then
    local last_msg
    last_msg="$(git log -1 --pretty=%s)"
    if ! printf '%s' "$last_msg" | grep -Eq "${issue_id//-/\\-}"; then
      warn "latest commit (${last_msg}) does not mention ${issue_id}; include it in the commit message"
    fi
  fi

  printf 'check-delivery: ready to mark issue done (clean tree, pushed)\n'
}

cmd_commit_msg() {
  local msg="${1:-}"
  shift || true
  [[ $# -eq 0 ]] || fail 'commit-msg accepts a single message argument'
  assert_commit_msg "$msg"
  printf 'check-delivery: commit message OK\n'
}

cmd_pre_push() {
  require_git_repo

  if [[ -n "$(git status --porcelain)" ]]; then
    warn 'working tree has uncommitted changes'
  fi

  local upstream
  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
  if [[ -n "$upstream" ]]; then
    local ahead behind
    ahead="$(git rev-list --count "${upstream}..HEAD" 2>/dev/null || echo 0)"
    behind="$(git rev-list --count "HEAD..${upstream}" 2>/dev/null || echo 0)"
    if [[ "$ahead" != "0" ]]; then
      printf 'check-delivery: pushing %s commit(s) to %s\n' "$ahead" "$upstream"
    fi
    if [[ "$behind" != "0" ]]; then
      warn "${behind} commit(s) behind ${upstream}; consider git pull --rebase"
    fi
  fi

  if git diff --name-only '@{u}'..HEAD -- 'src/client' 2>/dev/null | grep -q . || \
     git diff --name-only --cached -- 'src/client' | grep -q . || \
     git diff --name-only -- 'src/client' | grep -q .; then
    warn 'src/client changed — run npm run build before commit/push so dist/client matches UI'
  fi

  local last_msg
  last_msg="$(git log -1 --pretty=%s 2>/dev/null || true)"
  if [[ -n "$last_msg" ]] && ! printf '%s' "$last_msg" | grep -Eq "${ISSUE_ID_PATTERN}"; then
    warn "latest commit message missing issue identifier (${ISSUE_ID_PATTERN}); example: EGO-22: summary"
  fi

  printf 'check-delivery: pre-push reminders complete\n'
}

main() {
  local cmd="${1:-}"
  [[ -n "$cmd" ]] || { usage >&2; exit 1; }
  shift

  case "$cmd" in
    before-done) cmd_before_done "$@" ;;
    commit-msg) cmd_commit_msg "$@" ;;
    pre-push) cmd_pre_push "$@" ;;
    -h|--help|help) usage ;;
    *) fail "unknown command: $cmd" ;;
  esac
}

main "$@"

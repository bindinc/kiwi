#!/usr/bin/env bash
set -euo pipefail

# new_pr_worktree.sh
#
# One-step: derive codex/<kebab> branch from title -> create worktree -> (optional) create GitHub PR via gh.
#
# Usage:
#   ./scripts/new_pr_worktree.sh "Fix login race condition in auth flow"
#   ./scripts/new_pr_worktree.sh -b develop "Add OIDC SSO support"
#   ./scripts/new_pr_worktree.sh -b main -d "Short body" "Title"
#   ./scripts/new_pr_worktree.sh -b main --no-pr "Title only (no PR creation)"
#
# Notes:
# - Must be executed from the MAIN repo working directory (not from inside an existing worktree).
# - Worktrees are created in ../_worktrees/<branch_with_slashes_as__>

BASE="main"
CREATE_PR="auto"  # auto|yes|no
PR_BODY=""
TITLE=""

die() { echo "ERROR: $*" >&2; exit 1; }

require_git_repo() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not a git repository."
}

# Detect main worktree vs linked worktree:
# If .git is a file, we're inside a linked worktree. We want to run from the main checkout (recommended).
require_main_worktree() {
  if [[ -f .git ]]; then
    die "You appear to be inside a linked worktree (.git is a file). Run this from the main checkout directory."
  fi
}

slugify() {
  local raw="$1"
  local slug
  slug=$(echo "$raw" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g' \
    | sed -E 's/-{2,}/-/g' \
    | sed -E 's/^-|-$//g' \
    | cut -c1-40)
  [[ -n "$slug" ]] || die "Failed to derive branch slug from title."
  echo "$slug"
}

usage() {
  cat >&2 <<EOF
Usage:
  $0 [options] "<PR title>"

Options:
  -b, --base <branch>      Base branch (default: main)
  -d, --body "<text>"      PR body text (optional)
  --pr                     Force PR creation (requires gh)
  --no-pr                  Do NOT create PR
  -h, --help               Show help

Examples:
  $0 "Fix login race condition in auth flow"
  $0 -b develop -d "Implements OIDC flow + tests" "Add OIDC SSO support"
  $0 -b main --no-pr "Prep refactor work"
EOF
}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    -b|--base)
      shift; [[ $# -gt 0 ]] || die "Missing value for --base"
      BASE="$1"
      shift
      ;;
    -d|--body)
      shift; [[ $# -gt 0 ]] || die "Missing value for --body"
      PR_BODY="$1"
      shift
      ;;
    --pr)
      CREATE_PR="yes"
      shift
      ;;
    --no-pr)
      CREATE_PR="no"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      # Remaining args = title (support unquoted too)
      TITLE="${TITLE:+$TITLE }$1"
      shift
      ;;
  esac
done

[[ -n "$TITLE" ]] || { usage; exit 1; }

require_git_repo
require_main_worktree

# Ensure base exists remotely (best-effort)
git fetch --all --prune >/dev/null 2>&1 || true

SLUG="$(slugify "$TITLE")"
BRANCH="codex/${SLUG}"
BRANCH_DIR="${BRANCH//\//__}"
WT_DIR="../_worktrees/${BRANCH_DIR}"

echo "Title     : $TITLE"
echo "Base      : $BASE"
echo "Branch    : $BRANCH"
echo "Worktree  : $WT_DIR"

# Create worktree (new branch if not exists locally, otherwise add existing)
if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  echo "Local branch exists; adding worktree..."
  git worktree add "$WT_DIR" "$BRANCH"
else
  # Prefer remote base if available, else local base
  if git show-ref --verify --quiet "refs/remotes/origin/${BASE}"; then
    echo "Creating worktree from origin/$BASE..."
    git worktree add -b "$BRANCH" "$WT_DIR" "origin/$BASE"
  else
    echo "origin/$BASE not found; creating worktree from local $BASE..."
    git show-ref --verify --quiet "refs/heads/${BASE}" || die "Base branch '$BASE' not found locally or on origin."
    git worktree add -b "$BRANCH" "$WT_DIR" "$BASE"
  fi
fi

# Move into worktree
cd "$WT_DIR"
echo "Entered worktree: $(pwd)"
echo "Current branch  : $(git branch --show-current)"

# Create PR? (optional)
if [[ "$CREATE_PR" == "auto" ]]; then
  # Auto-create PR only if gh exists
  if command -v gh >/dev/null 2>&1; then
    CREATE_PR="yes"
  else
    CREATE_PR="no"
  fi
fi

if [[ "$CREATE_PR" == "yes" ]]; then
  command -v gh >/dev/null 2>&1 || die "gh not found but PR creation requested. Install GitHub CLI or rerun with --no-pr."

  # Push branch (even if no commits yet; user may commit later—Git will refuse if no commits diverge)
  # We do a safe push attempt after first commit is expected; but here we try and allow failure.
  echo "Attempting initial push (may fail if no commits yet)..."
  git push -u origin "$BRANCH" >/dev/null 2>&1 || echo "Note: push skipped/failed (likely no commits yet). After your first commit, run: git push -u origin \"$BRANCH\""

  # If push succeeded OR branch exists remotely, create PR
  # gh can create PR even if branch just pushed now; if branch doesn't exist remotely, it will fail.
  echo "Creating GitHub PR via gh..."
  if [[ -n "$PR_BODY" ]]; then
    gh pr create --base "$BASE" --head "$BRANCH" --title "$TITLE" --body "$PR_BODY" || \
      echo "PR creation failed (likely branch not pushed yet). After pushing, rerun: gh pr create --base \"$BASE\" --head \"$BRANCH\" --title \"$TITLE\" --body \"...\""
  else
    gh pr create --base "$BASE" --head "$BRANCH" --title "$TITLE" || \
      echo "PR creation failed (likely branch not pushed yet). After pushing, rerun: gh pr create --base \"$BASE\" --head \"$BRANCH\" --title \"$TITLE\""
  fi
else
  echo "PR creation: skipped."
  echo "When ready:"
  echo "  git push -u origin \"$BRANCH\""
  echo "  gh pr create --base \"$BASE\" --head \"$BRANCH\" --title \"$TITLE\""
fi

echo "Done."

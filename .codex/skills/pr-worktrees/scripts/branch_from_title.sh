#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   branch_from_title.sh "Fix login race condition in auth flow"
#
# Output:
#   codex/fix-login-race-condition

RAW_INPUT="${*:-}"

if [[ -z "$RAW_INPUT" ]]; then
  echo "Usage: branch_from_title.sh \"PR title or description\"" >&2
  exit 1
fi

# 1) lowercase
# 2) replace non-alphanumeric with hyphen
# 3) collapse multiple hyphens
# 4) trim leading/trailing hyphens
# 5) limit length (max 40 chars, sensible for branch names)
SLUG=$(echo "$RAW_INPUT" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g' \
  | sed -E 's/-{2,}/-/g' \
  | sed -E 's/^-|-$//g' \
  | cut -c1-40)

if [[ -z "$SLUG" ]]; then
  echo "Failed to derive branch name from input." >&2
  exit 1
fi

echo "codex/${SLUG}"

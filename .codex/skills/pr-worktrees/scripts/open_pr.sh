#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-main}"
BRANCH="${2:?Usage: open_pr.sh <base> <branch>}"
TITLE="${3:-}"
BODY="${4:-}"

git push -u origin "${BRANCH}"

if command -v gh >/dev/null 2>&1; then
  if [[ -n "${TITLE}" && -n "${BODY}" ]]; then
    gh pr create --base "${BASE}" --head "${BRANCH}" --title "${TITLE}" --body "${BODY}"
  else
    gh pr create --base "${BASE}" --head "${BRANCH}"
  fi
else
  echo "gh not found. Create PR manually on GitHub:"
  echo "  base: ${BASE}"
  echo "  head: ${BRANCH}"
fi

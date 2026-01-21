#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-main}"
BRANCH="${2:?Usage: create_worktree.sh <base> <branch>}"
# Worktree dir: replace / with __
BRANCH_DIR="${BRANCH//\//__}"
WT_DIR="../_worktrees/${BRANCH_DIR}"

git fetch --all --prune

if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  git worktree add "${WT_DIR}" "${BRANCH}"
else
  git worktree add -b "${BRANCH}" "${WT_DIR}" "origin/${BASE}"
fi

echo "Worktree created:"
echo "  BRANCH=${BRANCH}"
echo "  WT_DIR=${WT_DIR}"

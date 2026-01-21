---
name: pr-worktrees
description: Mandatory GitHub PR workflow using git worktrees and codex/... branches (one worktree per PR).
---

# Create GitHub PRs via git worktrees (Codex standard)

## When to use this skill
Use this skill **every time** the user asks to:
- create a new PR,
- start work that should result in a PR,
- pick up a task in a PR,
- or run multiple PRs in parallel.

This skill is **mandatory** and must not be bypassed.

## Goal and non-negotiable rules
1. **Never work in the main checkout.**  
   Always use a **dedicated git worktree** per PR.
2. Every PR must use its **own branch** under `codex/...`.
3. Every worktree must live under `../_worktrees/` (next to the main repo).
4. All changes, tests, and commits happen **exclusively inside the worktree**.
5. PR initialization must be done via the provided **one-step script**.
6. After work is complete, the branch must be pushed to `origin` and a **GitHub PR** must exist.

## Mandatory initialization (script-first)
Whenever a new PR is requested, you must **start by running**:

`scripts/new_pr_worktree.sh "<PR title>"`

- The PR title is required input and always in english.
- The default base branch is `main`, unless explicitly specified otherwise.
- The script will:
  - derive a short kebab-case branch name under `codex/...`,
  - create a dedicated git worktree under `../_worktrees/`,
  - create a GitHub PR automatically if `gh` is available,
  - and place you inside the correct worktree.

**Always use english for titles and text.**
**Do not create branches or worktrees manually.**  
**Do not modify files before this script has run successfully.**

## Naming conventions
- Base branch: `main` (unless explicitly overridden)
- Feature branch: `codex/<short-kebab-case-name>`
- Worktree directory:
  - `../_worktrees/` + branch name with `/` replaced by `__`
  - Example: `codex/fix-login` → `../_worktrees/codex__fix-login`

## Work execution (inside the worktree only)
1. Confirm you are inside the worktree directory.
2. Perform the requested code changes.
3. Run relevant tests and/or linters.
4. Create small, logical commits with clear commit messages.

## Push and PR finalization
- Ensure the branch is pushed to `origin`.
- If the PR was not created automatically:
  - create it using `gh pr create`.
- Update the PR description to include:
  - what was done,
  - why it was done,
  - which tests were run and their results.

## Reporting requirements (always include)
When reporting completion, always explicitly provide:
- Worktree path
- Branch name
- Summary of changes (bullet points)
- Test/check status
- PR link (or instructions if `gh` was not available)

## Parallel work
- Each PR must have its **own worktree and branch**.
- Multiple PRs may run in parallel, but **never** in the same worktree.

## Cleanup (explicit request only)
Only when the user explicitly asks for cleanup:
- From the main repo:
  - `git worktree remove "$WT_DIR"`
  - (optional) `git branch -D "$BRANCH"`

---

**Operational rule for Codex:**  
> New PR request = run `new_pr_worktree.sh` first, then start coding.

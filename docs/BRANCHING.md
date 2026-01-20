# Branching and Collaboration

## Goals
- Keep `main` green and demoable.
- Keep PRs small and easy to review.
- Allow parallel work without merge pain.

## Branch names
- Use short, descriptive names.
- Preferred patterns: `agent/<name>-<topic>` or `dev/<name>-<topic>`.
- Example: `agent/cloud-auth`, `dev/bob-subscriptions`.

## What is a vertical slice
A vertical slice is a small end-to-end change that delivers visible value.
It touches the UI, state, and storage or API for one outcome.

Use these checks:
- You can demo the change in 2 or 3 steps.
- It changes behavior, not only structure.
- It can be reviewed in one sitting.

Example slices for this project:
- Add a new cancellation reason: update the form, save it with the customer, show it in contact history.
- Add a new magazine type: add the option, pricing rules, and form validation.
- Add a queue setting: UI toggle, saved value, and simulation behavior.

## Feature flags
Use feature flags when a slice cannot be fully finished in one PR.
This repo has a small helper in `feature-flags.js`.

Rules:
- Query params override localStorage, localStorage overrides defaults.
- Prefix query flags with `ff-`.

Examples:
- Disable debug modal for a session: `?ff-debugModal=0`.
- Persist a flag in the browser console:
  - `window.featureFlags.setFlag('debugModal', false)`
- Clear a stored override:
  - `window.featureFlags.setFlag('debugModal')`

## Basic workflow
1. Update `main`.
2. Create a short-lived branch.
3. Build one vertical slice.
4. Rebase and open a PR using the template.

Example:
```
git switch main
git pull
git switch -c agent/cloud-auth
```

## Worktrees
A worktree is a second checkout of the same repo in another folder.
Each worktree has its own branch and working copy.

Common commands:
```
git worktree add ../kiwi-auth -b agent/cloud-auth
git worktree list
git worktree remove ../kiwi-auth
```

## Worktrees with Codex
- Start a new Codex session in each worktree folder.
- Each session works on its own branch without switching.
- Use small PRs to merge back to `main`.

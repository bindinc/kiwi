# Contributing

Kiwi is the customer-service portal for magazine subscriptions. Contributions
should keep the production and local gateway contracts intact, protect customer
data, and leave a clear trail of what changed, why it changed, and how it was
verified.

## Ground Rules

- Use English for repository content, commit messages, pull request titles, and
  pull request descriptions.
- Work in a dedicated git worktree and branch for every pull request. Do not make
  PR work in the main checkout.
- Keep changes small, reviewable, and tied to the user-facing or operational
  problem being solved.
- Update [CHANGELOG.md](CHANGELOG.md) under `[unreleased]` for every PR.
- Do not commit secrets, tokens, webhook URLs, OIDC client secrets, customer
  data, personal account data, production logs, or generated screenshots that can
  expose real data.
- Prefer repo-relative paths in documentation and scripts. Do not commit absolute
  paths from a developer machine.
- Preserve the active and preview gateway prefixes unless a change explicitly
  updates that contract:
  - production active: `https://bdc.rtvmedia.org/kiwi`
  - production preview: `https://bdc.rtvmedia.org/kiwi-preview`
  - local active: `https://bdc.rtvmedia.org.local/kiwi`
  - local preview: `https://bdc.rtvmedia.org.local/kiwi-preview`

## Pull Request Workflow

Start from an English pull request title. The default base branch is `main`
unless the requested work explicitly says otherwise. Derive the branch name as
`codex/<kebab-case-title>` and create the worktree under `../_worktrees/`.

```bash
PR_TITLE="Your English PR title"
BASE_BRANCH="main"
BRANCH_NAME="codex/<kebab-case-title>"
WORKTREE_PATH="../_worktrees/<kebab-case-title>"

git fetch origin
git switch "$BASE_BRANCH"
git pull --ff-only origin "$BASE_BRANCH"
git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "$BASE_BRANCH"
cd "$WORKTREE_PATH"
gh pr create --base "$BASE_BRANCH" --head "$BRANCH_NAME" --title "$PR_TITLE" || true
```

Do all code changes, tests, commits, pushes, and PR updates inside that worktree.
Before marking a PR ready, push the branch, ensure the PR exists, and update the
PR description with:

- what changed,
- why it changed,
- which tests were run and whether they passed.

## Development Setup

Kiwi runs as a Symfony 7.4 LTS application on FrankenPHP with PHP 8.4. Frontend
source is plain browser JavaScript managed through Symfony AssetMapper/importmap.
There is no separate frontend build pipeline for normal development.

Important paths:

- `src/` contains Symfony controllers, security, services, and domain code.
- `assets/` contains frontend source modules.
- `templates/` contains Twig templates.
- `tests/` contains PHP and frontend tests.
- `scripts/` contains local automation helpers.
- `infra/docker/` contains the local gateway and app image contracts.
- `docs/` contains project documentation and reference contracts.

Use Docker Compose for the standard local runtime:

```bash
make compose-up
```

The local HTTPS app should be reached through:

```text
https://bdc.rtvmedia.org.local/kiwi
```

The hosts file must map `bdc.rtvmedia.org.local` to `127.0.0.1`. Local OIDC and
Entra testing depend on the HTTPS gateway; port `443` is the expected browser
port for that flow unless a specific smoke-test command documents another port.

Stop the stack with:

```bash
make compose-down
```

## Local OIDC Modes

Docker Compose supports two OIDC modes.

External mode uses a local `client_secrets.json` with real provider values:

```bash
cp client_secrets.example.json client_secrets.json
```

Fallback mode starts local Keycloak automatically when `client_secrets.json` is
absent:

```bash
rm -f client_secrets.json
make compose-up
```

Fallback users all use password `kiwi-local-dev-password`:

| Username | Role |
| --- | --- |
| `kiwi-admin` | `bink8s.app.kiwi.admin` |
| `kiwi-dev` | `bink8s.app.kiwi.dev` |
| `kiwi-supervisor` | `bink8s.app.kiwi.supervisor` |
| `kiwi-user` | `bink8s.app.kiwi.user` |
| `kiwi-view` | `bink8s.app.kiwi.view` |
| `donny` | no Kiwi role; access denied is expected |

Fallback mode must use `openid email profile` scopes. Do not add Microsoft Graph
scopes to fallback mode.

Run the end-to-end fallback smoke check with:

```bash
make compose-smoke-oidc
```

## Verification

Run the narrowest useful tests while developing, then run the broader checks
that match the changed surface before reporting completion.

Common commands:

```bash
make phpunit
make js-test
make guardrail
git diff --check
```

Use `make compose-smoke-oidc` for changes that affect authentication, sessions,
gateway routing, local Docker Compose, fallback OIDC, or login/logout behavior.
Use `make image-build` for changes that affect the production Docker image.

If a command cannot be run, explain the blocker in the PR description and final
status instead of silently omitting it.

## Code Style

Write code for human readers first.

- Prefer readable conditionals with meaningful intermediate variables.
- Prefer early returns over deeply nested control flow.
- Keep functions focused, with explicit inputs and outputs.
- Avoid abstractions that only rename one line of code.
- Do not over-apply DRY when a small amount of duplication keeps behavior easier
  to understand.
- Add comments for non-obvious constraints, failure modes, and tradeoffs. Do not
  add comments that restate the next line of code.
- Model data so invalid states are difficult to represent.

For Symfony code, follow the existing controller, service, repository, and test
patterns in the nearby files before introducing new structure. For frontend
code, use the established `data-action` routing and module conventions; run
`make guardrail` before PR completion.

## Data, Secrets, And Screenshots

Kiwi handles customer-service workflows, authentication state, Teams presence,
Teams feedback delivery, and screenshots. Treat all of these as sensitive.

- Keep `client_secrets.json` local-only.
- Never commit webhook URLs, bearer tokens, refresh tokens, cookies, session
  values, customer records, or real screenshots from customer sessions.
- Do not log secrets or full upstream payloads unless the values are explicitly
  sanitized.
- Feedback screenshots must remain compatible with multiple replicas and
  `sessionAffinity: None`; do not store required runtime images only on a pod
  filesystem.
- Teams feedback messages should receive signed expiring image URLs rather than
  embedded base64 images.

## Documentation

Update documentation when behavior, commands, local setup, runtime contracts, or
operator expectations change. Prefer the existing `docs/` structure and link to
source-of-truth files instead of duplicating long explanations.

For architecture or deployment changes, also check:

- [README.md](README.md)
- [docs/reference/symfony-migration-contract-matrix.md](docs/reference/symfony-migration-contract-matrix.md)
- [docs/reference/action-router-conventions.md](docs/reference/action-router-conventions.md)
- [docs/explanation/cluster-follow-up.md](docs/explanation/cluster-follow-up.md)

## Changelog

Every PR requires one entry under `[unreleased]` in [CHANGELOG.md](CHANGELOG.md).
Keep entries concise and user- or operator-focused. Mention behavior changes,
new commands, migrations, security fixes, deployment changes, and compatibility
requirements.

## Commit Messages

Use small logical commits with clear imperative summaries. Conventional Commit
style is preferred when it fits:

```text
feat(feedback): pseudonymize screenshot text
fix(oidc): keep fallback scopes graph-free
docs(contributing): document Kiwi PR workflow
```

## Pull Request Checklist

- The work was done in a dedicated worktree under `../_worktrees/`.
- The branch name follows `codex/<kebab-case-title>` unless explicitly
  overridden.
- The change uses English for repository-facing text.
- `CHANGELOG.md` has one `[unreleased]` entry for the PR.
- Relevant PHP, frontend, guardrail, smoke, or image checks were run.
- Authentication, gateway, session, and replica behavior were considered when
  touched.
- Secrets and customer data were kept out of source, logs, fixtures, screenshots,
  and documentation.
- The PR description lists what changed, why it changed, and test results.

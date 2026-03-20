# General development rules

You are an engineer who writes code for **human brains, not machines**. Prefer code that is easy to understand, verify, and maintain. Human working memory is limited: readers can only hold a few facts in their head at once. When code forces them to track too many conditions, abstractions, or hidden assumptions, it becomes tiring to read and easy to break.

These rules apply everywhere, especially in new code and meaningful refactors. For trivial edits, generated code, or vendor code, follow them where practical and do not create churn by forcing broad rewrites.

Prefer code like this:
```
isValid = val > someConstant
isAllowed = condition2 || condition3
isSecure = condition4 && !condition5

if isValid && isAllowed && isSecure {
    ...
}
```

### Readability and flow
- Make conditionals readable. Extract dense expressions into intermediate variables with meaningful names.
- Prefer early returns over nested conditionals so readers can focus on the happy path.
- Stick to the smallest useful subset of the language. Readers should not need advanced language trivia to follow the code.
- Avoid unnecessary abstraction layers. A straight line of thought is usually easier to follow than jumping across many tiny wrappers.
- Prefer composition over deep inheritance. Do not force readers to chase behavior across multiple classes.
- Do not over-apply DRY. A little duplication is often cheaper than unnecessary shared dependencies.
- Use self-descriptive values and avoid custom mappings that require memorization.

### Functions
- Prefer small semantic functions with explicit inputs and explicit outputs. A function should do what its name says and nothing extra.
- Keep side effects out of semantic functions unless the side effect is the explicit purpose of the function.
- If a well-defined flow appears in multiple places, capture it in a clearly named function instead of re-explaining it with comments.
- Avoid shallow methods, classes, or modules with complex interfaces and trivial behavior. Prefer deeper units with simple interfaces and meaningful internal work.

### Orchestration
- Use pragmatic functions to orchestrate workflows, integrate side effects, and connect several semantic functions into one process.
- Pragmatic functions may contain more complex control flow, but they should stay readable and should not turn into vague utility buckets.
- Add doc comments only when they explain non-obvious behavior, constraints, failure modes, or important tradeoffs.
- Do not write "WHAT" comments that merely restate the next line of code. Use comments for "WHY", caveats, or a bird's-eye view of a block.

### Models
- Model data so that invalid states are difficult or impossible to represent.
- Use precise names and types. If a field does not clearly belong to the model's name, the model is probably too broad.
- Be suspicious of growing piles of optional fields. Split broad models into smaller concepts instead of turning them into loose bags of data.
- Prefer domain-specific types when identical shapes represent different concepts.

## Mandatory default
Whenever I ask for a **new PR** (or any task that should result in a PR), you must **always** follow the workflow below. Deviating from this process is not allowed.

## Step 1 — Initialize PR + worktree (mandatory)
- Always start from an English PR title.
- The default base branch is `main`, unless I explicitly specify otherwise.
- Derive a branch name in the format `codex/<kebab-case-title>`.
- Create a **dedicated git worktree** under `../_worktrees/` and switch into it before making changes.
- Create the GitHub PR immediately if possible.
- Reference command sequence:
  ```bash
  PR_TITLE="Your English PR title"
  BASE_BRANCH="main" # change only when explicitly requested
  BRANCH_NAME="codex/<kebab-case-title>"
  WORKTREE_PATH="../_worktrees/<kebab-case-title>"

  git fetch origin
  git switch "$BASE_BRANCH"
  git pull --ff-only origin "$BASE_BRANCH"
  git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "$BASE_BRANCH"
  cd "$WORKTREE_PATH"
  gh pr create --base "$BASE_BRANCH" --head "$BRANCH_NAME" --title "$PR_TITLE" || true
  ```

**Always use english for titles and text.**
**We require one CHANGELOG.md entry per PR.**
**Never work in the main checkout.**  
**Never work without a worktree.**

## Step 2 — Perform the work
- All code changes, tests, and commits must be done **exclusively** inside the created worktree.
- Create small, logical commits with clear commit messages.
- Run the relevant tests and/or linters before reporting completion.

## Step 3 — Push & finalize the PR
- Ensure the branch is pushed to `origin`.
- Ensure the CHANGELOG.md is up to date with the changes we made under 'unreleased'
- If the PR does not yet exist, create it using `gh pr create`.
- Update the PR description with:
  - what was done,
  - why it was done,
  - which tests were run and their results.

## Reporting requirements (always include)
When reporting completion, always explicitly include:
- Worktree path
- Branch name
- Summary of changes (bullet points)
- Test status
- PR link

## Parallel work
- Each new PR must use **its own worktree and branch**.
- Multiple PRs may run in parallel, but **never** in the same worktree.

## Cleanup
- Remove worktrees **only** when I explicitly ask you to do so.

---

## Gateway API (nginx gateway fabric)

- The production active flask app is at url `https://bdc.rtvmedia.org/kiwi` on production
- The production preview flask app is at url `https://bdc.rtvmedia.org/kiwi-preview` on production

- The local active flask app is available at url `https://bdc.rtvmedia.org.local/kiwi` on local development docker-desktop cluster.
- The local preview flask app is available at url `https://bdc.rtvmedia.org.local/kiwi-preview` on local development docker-desktop cluster.
- A local hosts file is already configured to point 127.0.0.1 to bdc.rtvmedia.org.local
- certificates on production should be managed by cert-manager issuer-letsencrypt
- certificates on local development should be managed by cert-manager local CA

## Local fallback OIDC quick validation

- If `client_secrets.json` is missing in the workspace root, Docker Compose automatically uses fallback Keycloak.
- Fallback OIDC login URL is served through `https://bdc.rtvmedia.org.local/kiwi-oidc`.
- Fallback test users (password for all: `kiwi-local-dev-password`):
  - `kiwi-admin` -> `bink8s.app.kiwi.admin`
  - `kiwi-dev` -> `bink8s.app.kiwi.dev`
  - `kiwi-supervisor` -> `bink8s.app.kiwi.supervisor`
  - `kiwi-user` -> `bink8s.app.kiwi.user`
  - `kiwi-view` -> `bink8s.app.kiwi.view`
  - `donny` -> no Kiwi role (expected access denied)
- For fallback mode, app scopes must be `openid email profile` (no `User.Read`).
- To validate fallback end-to-end, run `make compose-smoke-oidc`.

## requirements dev/local/prod
- For local development we want to use the docker-compose.yaml to mimic the kubernetes gitops environment without actually starting a complete kubernetes cluster
- Kiwi must be tested and approved using a flux bootstrapped bink8s-cluster-management repo on a kind 3 node docker-desktop local cluster.
- Kiwi will be deployed on the flux bootstrapped bink8s-cluster-management repo (prod) on the 3 master node + reverse proxy bink8s cluster
- for local/prod k8s: we have 3 master nodes and require that kiwi is replicated on each master node. 
- for local/prod k8s: We use `sessionAffinity: None`, since the reverse proxy uses round robin to access each master node. This means that we need to take into account that each https:// call could reach a different replica of the kiwi app pod.

## tools
- Always use context7 when I need code generation, setup or configuration steps, or library/API documentation. This means you should automatically use the Context7 MCP tools to resolve library id and get library docs without me having to explicitly ask.

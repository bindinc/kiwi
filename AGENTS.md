Always use context7 when I need code generation, setup or configuration steps, or library/API documentation. This means you should automatically use the Context7 MCP tools to resolve library id and get library docs without me having to explicitly ask.

# General development rules

You are an engineer who writes code for **human brains, not machines**. You favour code that is simple to undertand and maintain. Remember at all times that the code you will be processed by human brain. The brain has a very limited capacity. People can only hold ~4 chunks in their working memory at once. If there are more than four things to think about, it feels mentally taxing for us.

Here's an example that's hard for people to understand:
```
if val > someConstant // (one fact in human memory)
    && (condition2 || condition3) // (three facts in human memory), prev cond should be true, one of c2 or c3 has be true
    && (condition4 && !condition5) { // (human memory overload), we are messed up by this point
    ...
}
```

A good example, introducing intermediate variables with meaningful names:
```
isValid = val > someConstant
isAllowed = condition2 || condition3
isSecure = condition4 && !condition5 
// (human working memory is clean), we don't need to remember the conditions, there are descriptive variables
if isValid && isAllowed && isSecure {
    ...
}
```

- Don't write useless "WHAT" comments, especially the ones that duplicate the line of the following code. "WHAT" comments only allowed if they give a bird's eye overview, a description on a higher level of abstraction that the following block of code. Also, write "WHY" comments, that explain the motivation behind the code (why is it done in that specific way?), explain an especially complex or tricky part of the code.
- Make conditionals readable, extract complex expressions into intermediate variables with meaningful names.
- Prefer early returns over nested ifs, free working memory by letting the reader focus only on the happy path only.
- Prefer composition over deep inheritance, don’t force readers to chase behavior across multiple classes.
- Don't write shallow methods/classes/modules (complex interface, simple functionality). An example of shallow class: `MetricsProviderFactoryFactory`. The names and interfaces of such classes tend to be more mentally taxing than their entire implementations. Having too many shallow modules can make it difficult to understand the project. Not only do we have to keep in mind each module responsibilities, but also all their interactions.
- Prefer deep method/classes/modules (simple interface, complex functionality) over many shallow ones. 
- Don't overuse language featuress, stick to the minimal subset. Readers shouldn't need an in-depth knowledge of the language to understand the code.
- Use self-descriptive values, avoid custom mappings that require memorization.
- Don't abuse DRY, a little duplication is better than unnecessary dependencies.
- Avoid unnecessary layers of abstractions, jumping between layers of abstractions (like many small methods/classes/modules) is mentally exhausting, linear thinking is more natural to humans.

## Mandatory default
Whenever I ask for a **new PR** (or any task that should result in a PR), you must **always** follow the workflow below. Deviating from this process is not allowed.

## Step 1 — Initialize PR + worktree (mandatory)
- Pass the PR title as input to the script.
- The default base branch is `main`, unless I explicitly specify otherwise.
- The script will:
  - generate a `codex/...` kebab-case branch name,
  - create a **dedicated git worktree** under `../_worktrees/`,
  - create a **GitHub PR** immediately if possible,
  - and place you inside the correct worktree.

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
- certificates on local development should be managed by cert-manager issuer-staging

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

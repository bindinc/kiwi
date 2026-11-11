# Use the Codex sensitive-data guard

Kiwi includes project-local Codex hooks that reduce the risk of sensitive data reaching a Codex prompt or a public repository change. The guard runs offline using Node.js and Git; the optional Go reference exception also needs a trusted native Go formatter. It never writes a report, baseline, transcript, or matched value.

This is a Codex guardrail. It does not install Git hooks and does not change `core.hooksPath`.

## Enable the project hooks

1. Open Kiwi in Codex from the repository root or one of its subdirectories.
2. Run `/hooks` in Codex.
3. Review `.codex/hooks.json` and `.codex/hooks/secret-guard.mjs`.
4. Trust the current hook definition.

Codex stores trust against the hook definition's hash. Repeat the review after either hook file changes. Until the project `.codex` layer and the current hook hash are trusted, Codex skips these project hooks.

The configuration follows the [official OpenAI Codex hooks documentation](https://learn.chatgpt.com/docs/hooks).

## What the guard checks

| Lifecycle event | Check | Blocking behavior |
| --- | --- | --- |
| `UserPromptSubmit` | Scans the submitted prompt for high-confidence secret patterns. | Rejects the prompt before Codex sends it. |
| `PreToolUse` | Checks shell commands, patches, and GitHub tool arguments. It also runs a repository preflight before `git push`, `gh pr create`, and GitHub publication tools. | Denies the tool call before it runs. |
| `PostToolUse` | Scans added diff lines and newly introduced sensitive paths after shell or patch operations. | Replaces the normal tool result with redacted remediation feedback; it cannot undo the completed operation. |
| `Stop` | Runs the same repository scan before Codex finishes a turn. | Continues Codex once so the finding can be fixed. A repeated stop returns a warning without creating an infinite continuation loop. |

The repository scan covers unstaged changes, staged changes, commits ahead of the branch upstream, and non-ignored untracked path names. It resolves the Git root first, so starting Codex in a repository subdirectory has the same behavior.

Rules include:

- private-key headers, bearer tokens, JWTs, provider-specific token formats, credentialed URLs, and signed webhook URLs;
- non-placeholder values assigned to password, token, secret, and API-key fields;
- newly introduced local environment files, private-key files, credential files, and kubeconfig paths;
- shell commands that read likely local secret sources;
- every `git add --force` or `git add -f`, because it can bypass the repository ignore policy.

Finding messages contain only a rule identifier and a sanitized repository-relative source. They never contain the matched value.

## Runtime references in JavaScript

SG007 distinguishes unquoted environment member references from literal credentials when the complete `.js`, `.mjs` or `.cjs` source is available. Supported roots are `process.env`, `source` and `env`, followed by an uppercase environment variable name. Quoted values remain subject to the normal credential check.

The guard uses Node's syntax-only check with an empty environment; it never executes the source or loads its imports. Replacing the candidate with an invalid syntax token must invalidate otherwise valid JavaScript. Text in strings, templates, comments and regex literals does not receive an exception merely because it resembles code. All other secret detectors still run.

Full source is available for new files in `apply_patch` and for the complete Git diffs scanned before publication, after tools and at stop. Existing-file patches provide incomplete context and deliberately remain strict, as do shell commands, prompts, JSON/YAML and generic tool inputs. A false positive in these contexts still needs review; this exception does not authorize disabling the hook.

At most 12 syntax checks run per hook invocation, each limited to 300 milliseconds. Exhausted limits, unsupported syntax and parser failures retain the finding. Git diff collection is still bounded by the existing 8 MiB limit; oversized input fails closed.

## Runtime references in Go

Complete `.go` source can exempt an unquoted direct selector expression when
both syntax checks prove its code position. Native `gofmt` must accept the
original source; replacing the exact candidate with `@` must produce its specific
invalid-character parser diagnostic. A dotted spelling alone grants nothing.
Quoted/raw strings, comments and struct tags remain data. Calls, indexing,
concatenation and type assertions are not eligible. Parenthesized RHS values are
outside SG007's existing assignment matcher; this change does not expand that
detector. The exception proves syntactic code position only, not a field's type,
ownership or application semantics. Imports, initializers, build directives and
generators are never executed; source is neither compiled nor written.

The Linux resolver checks an absolute inherited `GOROOT/bin/gofmt` first, then
`/usr/local/go/bin/gofmt` and `/usr/bin/gofmt`. `GOROOT` is trusted machine/session
configuration, not a hook-input option. The guard does not search PATH. It
resolves symlinks, rejects executables inside any Git checkout/worktree and
requires an executable native ELF file rather than a script wrapper. The ELF
check establishes file format, not cryptographic authenticity: install Go from
a trusted distribution and protect its directory. Unsupported or missing
formatters retain SG007.

Before parsing, a bounded prefix check skips only an optional initial BOM,
Go whitespace and closed leading comments, then requires the exact `package`
keyword with a whitespace/comment separator. This excludes gofmt's stdin
statement/declaration-fragment fallback, including identifiers like `packageπ`.
Strings/raw strings are not skipped; the native parser still validates the
complete remaining grammar. No source-provided path or flags are used. The
subprocess reads stdin with an empty environment and no shell. Formatted
stdout is discarded; stderr is capped at 64 KiB and never included in findings.
Each process has a 300 ms timeout with SIGKILL and input is limited to 8 MiB.
Go and JavaScript share the same 12-check budget (at most 3.6 s of checker time,
excluding OS scheduling/I/O). Unknown exit statuses, crashes, signals,
diagnostics, output errors and exhausted budgets retain SG007.

Full-source context is limited to Add File patches and complete repository
diffs. Existing-file/partial/multi-hunk patches, prompts, Bash and generic tool
strings remain strict. A reference in an Update patch can therefore still be
blocked; this change does not reconstruct or read target files.

Before adoption, separately review the PR, provide trusted native `gofmt`
(Go1.27.4 is tested), run the focused suite with that parser present and explicitly
review/trust the changed project hook. Do not update the loaded checkout or hook
source before review and explicit activation: the hook command resolves source
dynamically and an update can affect a subsequent call. The feature worktree is
currently inactive because the loaded main hook remains untouched. CI explicitly installs Go and
runs the hook tests; positive tests never skip when the parser is missing.
Local parser-positive validation uses an isolated Go container, not a host
installation. See the official [gofmt documentation](https://pkg.go.dev/cmd/gofmt)
and [fragment-selection implementation](https://go.dev/src/cmd/gofmt/gofmt.go).

## Respond to a block

1. Do not paste the rejected value into chat, an issue, a commit message, or a command argument.
2. Remove the value from the prompt, patch, command, file, staged diff, or unpublished commit.
3. Replace examples with a clear placeholder such as `<api-key>` or `<webhook-url>`.
4. Store real values in the existing local or platform-native secret store.
5. If the value was real and reached any shared system, treat it as exposed and rotate or revoke it.
6. Retry the Codex action after the repository scan is clean.

If a false positive is suspected, review the rule identifier and the sanitized path. Do not weaken or bypass the hook to publish the value. Change the example to an unmistakable placeholder or adjust the narrowly scoped detector with regression coverage.

## Validate changes to the guard

Run the dependency-free hook tests:

```bash
node --test tests/codex-hooks/secret-guard.test.mjs
```

Then run the existing repository checks:

```bash
make js-test
make guardrail
git diff --check
```

The tests construct synthetic candidates from fragments at runtime. Token-shaped fixtures must not be committed, even when they are fake.

## Security boundary

Codex hooks are defense in depth, not a complete enforcement boundary:

- They cover trusted Codex sessions and the tool paths that Codex exposes to hooks.
- Users can disable non-managed hooks, decline trust, or use tools outside Codex.
- Some specialized Codex tool paths can opt out of lifecycle hooks.
- `PostToolUse` runs after the side effect and cannot undo it.
- The guard scans changed content rather than every tracked file, and it does not open ignored secret files.
- Detection is deliberately high confidence; no pattern-based scanner can identify every sensitive value.

Keep repository rules, least-privilege credentials, GitHub secret scanning, and GitHub push protection enabled as separate enforcement layers.

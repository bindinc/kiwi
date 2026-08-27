# Use the Codex sensitive-data guard

Kiwi includes project-local Codex hooks that reduce the risk of sensitive data reaching a Codex prompt or a public repository change. The guard runs offline, has no dependencies beyond Node.js and Git, and never writes a report, baseline, transcript, or matched value.

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

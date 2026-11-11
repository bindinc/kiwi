# Go reference recognition in the secret guard

Story: [SC-206963](https://app.shortcut.com/bindincit/story/206963).
Status: draft implementation scope; no hook activation or merge is authorized.

The targeted change extends SG007's existing syntax-proof approach to complete
Go source. A candidate must be an unquoted pure selector expression with an
explicit expression boundary. A native syntax checker must accept the complete
original source and reject an otherwise identical source with the candidate
replaced by an invalid token. Matching a dotted spelling or a .go filename is
insufficient. This proves source-code position, not a configuration field's type
or ownership. It does not execute candidate code, load its imports or type-check.

The proposed checker is the Go toolchain's standalone gofmt executable, with
bounded input, output, time and per-hook checks. Missing checker, parse failure,
process errors, signals, exhausted budget or uncertain outcomes retain SG007.
Prompts, Bash, generic tool input and incomplete update patches remain strict.
Other secret rules retain their independent findings.

Tests will exercise actual hook JSON/CLI and patch processing, complete
repository diffs and negative literal/comment/raw-string/ambiguous cases. CI
must explicitly install/check the public parser toolchain and execute the hook
tests; Go-positive tests must not silently skip when the parser is missing.
Missing/error/timeout behavior requires deterministic tests too.

Implementation occurs only in this dedicated feature worktree. The loaded main
checkout, its hook/configuration and trust state remain unchanged. Review,
merge and explicit activation are separate gates. No credential values are
needed for implementation or validation; synthetic test candidates are assembled
at runtime in line with existing guard tests.

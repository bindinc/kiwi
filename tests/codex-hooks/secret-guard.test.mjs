import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  evaluateHook,
  checkGoSyntax,
  goFormatterCandidates,
  resolveGoFormatter,
  hasGoPackageClause,
  scanRepository,
  isForbiddenPath,
} from "../../.codex/hooks/secret-guard.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const hookScript = path.join(repositoryRoot, ".codex/hooks/secret-guard.mjs");

function runGit(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });

  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed: ${result.stderr}`,
  );

  return result.stdout;
}

function createRepository() {
  const root = mkdtempSync(path.join(tmpdir(), "kiwi-codex-hook-"));
  const remote = path.join(root, "remote.git");
  const repository = path.join(root, "repository");

  mkdirSync(repository);
  runGit(root, ["init", "--bare", remote]);
  runGit(repository, ["init", "--initial-branch=main"]);
  runGit(repository, ["config", "user.email", "codex-hook@example.invalid"]);
  runGit(repository, ["config", "user.name", "Codex Hook Test"]);
  runGit(repository, ["config", "commit.gpgsign", "false"]);

  writeFileSync(path.join(repository, "README.md"), "# Test repository\n");
  runGit(repository, ["add", "README.md"]);
  runGit(repository, ["commit", "-m", "Initial commit"]);
  runGit(repository, ["remote", "add", "origin", remote]);
  runGit(repository, ["push", "-u", "origin", "main"]);

  return {
    repository,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function preToolEvent(cwd, toolName, toolInput) {
  return {
    hook_event_name: "PreToolUse",
    cwd,
    tool_name: toolName,
    tool_input: toolInput,
  };
}

function runHookCli(eventOrInput) {
  const input = typeof eventOrInput === "string"
    ? eventOrInput
    : JSON.stringify(eventOrInput);

  return spawnSync(process.execPath, [hookScript], {
    cwd: repositoryRoot,
    encoding: "utf8",
    input,
  });
}

test("allows a clean prompt", () => {
  const result = evaluateHook({
    hook_event_name: "UserPromptSubmit",
    cwd: repositoryRoot,
    prompt: "Document how the local OIDC fallback is configured.",
  });

  assert.deepEqual(result, {});
});

test("blocks a provider token without returning its value", () => {
  const candidate = ["github", "_pat_", "A".repeat(36)].join("");
  const result = evaluateHook({
    hook_event_name: "UserPromptSubmit",
    cwd: repositoryRoot,
    prompt: `Please use ${candidate} for this request.`,
  });
  const output = JSON.stringify(result);

  assert.equal(result.decision, "block");
  assert.match(output, /SG004-provider-token/);
  assert.doesNotMatch(output, new RegExp(candidate));
});

test("blocks a private key header assembled at runtime", () => {
  const candidate = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
  const result = evaluateHook({
    hook_event_name: "UserPromptSubmit",
    cwd: repositoryRoot,
    prompt: candidate,
  });

  assert.equal(result.decision, "block");
  assert.match(JSON.stringify(result), /SG001-private-key/);
});

test("allows documented environment templates but rejects local secret paths", () => {
  assert.equal(isForbiddenPath(".env.example"), false);
  assert.equal(isForbiddenPath("config/.env.test"), true);
  assert.equal(isForbiddenPath("client_secrets.json"), true);
  assert.equal(isForbiddenPath("certificates/service.key"), true);
});

test("blocks an apply_patch call that adds a forbidden path", () => {
  const patch = [
    "*** Begin Patch",
    "*** Add File: client_secrets.json",
    "+{}",
    "*** End Patch",
  ].join("\n");
  const result = evaluateHook(preToolEvent(
    repositoryRoot,
    "apply_patch",
    { command: patch },
  ));

  assert.equal(result.hookSpecificOutput.permissionDecision, "deny");
  assert.match(JSON.stringify(result), /SG008-sensitive-path/);
});

test("blocks moving a file to a forbidden path", () => {
  const patch = [
    "*** Begin Patch",
    "*** Update File: config/example.json",
    "*** Move to: client_secrets.json",
    "@@",
    " {}",
    "*** End Patch",
  ].join("\n");
  const result = evaluateHook(preToolEvent(
    repositoryRoot,
    "apply_patch",
    { command: patch },
  ));

  assert.equal(result.hookSpecificOutput.permissionDecision, "deny");
  assert.match(JSON.stringify(result), /SG008-sensitive-path/);
});

test("blocks a direct GitHub publication to a forbidden path", () => {
  const result = evaluateHook(preToolEvent(
    repositoryRoot,
    "mcp__codex_apps__github_create_file",
    {
      path: "config/client_secrets.json",
      content: "{}",
      repository_full_name: "bindinc/kiwi",
    },
  ));

  assert.equal(result.hookSpecificOutput.permissionDecision, "deny");
  assert.match(JSON.stringify(result), /SG008-sensitive-path/);
});

test("blocks webhook signatures without returning their value", () => {
  const candidate = [
    "https://hooks.example.invalid/callback?",
    "sig=",
    "A".repeat(32),
  ].join("");
  const result = evaluateHook(preToolEvent(
    repositoryRoot,
    "mcp__codex_apps__github_create_file",
    { content: candidate },
  ));
  const output = JSON.stringify(result);

  assert.equal(result.hookSpecificOutput.permissionDecision, "deny");
  assert.match(output, /SG005-webhook-signature/);
  assert.equal(output.includes(candidate), false);
});

test("blocks shell reads from likely secret sources", () => {
  const result = evaluateHook(preToolEvent(
    repositoryRoot,
    "Bash",
    { command: "sed -n '1,20p' client_secrets.json" },
  ));

  assert.equal(result.hookSpecificOutput.permissionDecision, "deny");
  assert.match(JSON.stringify(result), /SG009-sensitive-file-read/);
});

test("blocks force-adding ignored files", () => {
  const result = evaluateHook(preToolEvent(
    repositoryRoot,
    "Bash",
    { command: "git add --force client_secrets.json" },
  ));

  assert.equal(result.hookSpecificOutput.permissionDecision, "deny");
  assert.match(JSON.stringify(result), /SG010-force-add/);
});

test("allows a clean push preflight from a repository subdirectory", () => {
  const fixture = createRepository();
  const subdirectory = path.join(fixture.repository, "src");
  mkdirSync(subdirectory);

  try {
    const result = evaluateHook(preToolEvent(
      subdirectory,
      "Bash",
      { command: "git push" },
    ));

    assert.deepEqual(result, {});
  } finally {
    fixture.cleanup();
  }
});

test("blocks push, post-tool, and stop flows for a sensitive added line", () => {
  const fixture = createRepository();
  const candidate = ["client_", "secret=", "A".repeat(24)].join("");

  writeFileSync(path.join(fixture.repository, "settings.ini"), `${candidate}\n`);
  runGit(fixture.repository, ["add", "settings.ini"]);

  try {
    const pushResult = evaluateHook(preToolEvent(
      fixture.repository,
      "Bash",
      { command: "git push" },
    ));
    const postResult = evaluateHook({
      hook_event_name: "PostToolUse",
      cwd: fixture.repository,
      tool_name: "Bash",
      tool_input: { command: "git status --short" },
      tool_response: {},
    });
    const firstStop = evaluateHook({
      hook_event_name: "Stop",
      cwd: fixture.repository,
      stop_hook_active: false,
    });
    const repeatedStop = evaluateHook({
      hook_event_name: "Stop",
      cwd: fixture.repository,
      stop_hook_active: true,
    });
    const output = JSON.stringify({
      pushResult,
      postResult,
      firstStop,
      repeatedStop,
    });

    assert.equal(pushResult.hookSpecificOutput.permissionDecision, "deny");
    assert.equal(postResult.decision, "block");
    assert.equal(firstStop.decision, "block");
    assert.equal(repeatedStop.continue, false);
    assert.match(output, /SG007-credential-assignment/);
    assert.equal(output.includes(candidate), false);
  } finally {
    fixture.cleanup();
  }
});

test("the command entrypoint fails closed on malformed JSON", () => {
  const result = runHookCli("{");

  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /failed closed/);
});

test("the command entrypoint emits only redacted findings", () => {
  const candidate = ["gh", "p_", "A".repeat(36)].join("");
  const result = runHookCli({
    hook_event_name: "UserPromptSubmit",
    cwd: repositoryRoot,
    prompt: candidate,
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /SG004-provider-token/);
  assert.equal(result.stdout.includes(candidate), false);
  assert.equal(result.stderr, "");
});

function newSourcePatch(source, filePath = "automation/launcher.mjs") {
  return [
    "*** Begin Patch",
    `*** Add File: ${filePath}`,
    ...source.split("\n").map((line) => `+${line}`),
    "*** End Patch",
  ].join("\n");
}

function checkNewSource(source, filePath) {
  return evaluateHook(preToolEvent(repositoryRoot, "apply_patch", {
    command: newSourcePatch(source, filePath),
  }));
}

const runtimeReference = ["source", "INTEGRATIONS_API_KEY"].join(".");
const goReference = ["app", "config", "ClientSecret"].join(".");

function goSource(value = goReference) {
  return [
    "package fixture",
    'import "module-that-must-not-be-loaded"',
    "func build() any {",
    `return Config{ClientSecret: ${value},}`,
    "}",
  ].join("\n");
}

test("Go configuration selectors require real parser proof through hook JSON and patches", () => {
  const source = goSource();
  assert.deepEqual(checkNewSource(source, "auth.go"), {});
  const result = runHookCli(preToolEvent(repositoryRoot, "apply_patch", {
    command: newSourcePatch(source, "auth.go"),
  }));
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), {});
});

test("Go selector proof retains exact position with Unicode and CRLF prefixes", () => {
  for (const newline of ["\n", "\r\n"]) {
    const source = "// Café 🙂" + newline + goSource().replaceAll("\n", newline);
    assert.deepEqual(checkNewSource(source, "auth.go"), {});
  }
});

test("Go literals, comments, raw strings and tags remain data", () => {
  const assignment = `ClientSecret: ${goReference},`;
  const sources = [
    `package fixture\n// ${assignment}`,
    `package fixture\n/*\n${assignment}\n*/`,
    `package fixture\nvar text = "${assignment}"`,
    `package fixture\nvar text = \`\n${assignment}\n\``,
    `package fixture\ntype row struct { Value string \`${assignment}\` }`,
    goSource(`"${goReference}"`),
    goSource("\"" + "A".repeat(24) + "\""),
  ];
  for (const source of sources) assertAssignmentBlocked(checkNewSource(source, "auth.go"));
});

test("Go selector calls, indexing, concatenation and malformed source fail closed", () => {
  for (const suffix of ["()", "[0]", ' + "suffix"', "...", ".(string)"]) {
    assertAssignmentBlocked(checkNewSource(goSource(goReference + suffix), "auth.go"));
  }
  assertAssignmentBlocked(checkNewSource(goSource().slice(0, -2), "auth.go"));
  assertAssignmentBlocked(checkNewSource(goSource(), "auth.txt"));
  // Parenthesized values are outside the existing assignment matcher; this
  // change must not pretend to reject them or invoke a syntax exception.
  let checks = 0;
  evaluateHook(preToolEvent(repositoryRoot, "apply_patch", {
    command: newSourcePatch(goSource(`(${goReference})`), "auth.go"),
  }), () => { checks += 1; return true; });
  assert.equal(checks, 0);
});

test("Go shell, prompt, generic input and incomplete update transport remain strict", () => {
  const source = goSource();
  assertAssignmentBlocked(evaluateHook(preToolEvent(repositoryRoot, "Bash", { command: source })));
  assertAssignmentBlocked(evaluateHook(preToolEvent(repositoryRoot, "unknown", { path: "auth.go", content: source })));
  assertAssignmentBlocked(evaluateHook(preToolEvent(repositoryRoot, "apply_patch", { command: [
    "*** Begin Patch", "*** Update File: auth.go", "@@", ...source.split("\n").map((line) => "+" + line), "*** End Patch",
  ].join("\n") })));
  assert.equal(evaluateHook({ hook_event_name: "UserPromptSubmit", cwd: repositoryRoot, prompt: source }).decision, "block");
});

test("Go parser missing, timeout, crash, output errors and unknown diagnostics are uncertain", () => {
  const failures = [
    { error: new Error("ENOENT") }, { error: new Error("ETIMEDOUT"), signal: "SIGTERM" },
    { signal: "SIGKILL" }, { error: new Error("ENOBUFS") },
    { status: 2, stderr: "unexpected operational failure" },
    { status: 0, stderr: "unexpected warning" }, { status: 1, stderr: "" },
  ];
  assert.equal(checkGoSyntax(goSource(), { remaining: 12 }, () => { throw new Error("must not run"); }, null), null);
  for (const result of failures) {
    assert.equal(checkGoSyntax(goSource(), { remaining: 12 }, () => result, "/trusted/gofmt"), null);
    assertAssignmentBlocked(evaluateHook(preToolEvent(repositoryRoot, "apply_patch", {
      command: newSourcePatch(goSource(), "auth.go"),
    }), (source, budget) => checkGoSyntax(source, budget, () => result, "/trusted/gofmt")));
  }
  assertAssignmentBlocked(evaluateHook(preToolEvent(repositoryRoot, "apply_patch", {
    command: newSourcePatch(goSource(), "auth.go"),
  }), (source, budget) => checkGoSyntax(source, budget, () => {}, null)));
  assert.equal(checkGoSyntax(goSource(), { remaining: 0 }, () => { throw new Error("must not run"); }, "/trusted/gofmt"), null);
});

test("Go parser budget exhaustion retains SG007 and source contexts reset per file", () => {
  const many = Array.from({ length: 15 }, (_, index) =>
    `var config${index} = Config{ClientSecret: ${goReference},}`,
  ).join("\n");
  assertAssignmentBlocked(checkNewSource("package fixture\n" + many, "auth.go"));
  const patch = [
    "*** Begin Patch", "*** Add File: first.go",
    ...goSource().split("\n").map((line) => "+" + line),
    "*** Add File: second.go", "+package fixture", "+/*",
    `+ClientSecret: ${goReference},`, "+*/", "*** End Patch",
  ].join("\n");
  assertAssignmentBlocked(evaluateHook(preToolEvent(repositoryRoot, "apply_patch", { command: patch })));
  const mixed = [
    "*** Begin Patch", "*** Add File: first.mjs",
    ...Array.from({ length: 6 }, (_, index) => `+const config${index} = { apiKey: ${runtimeReference} };`),
    "*** Add File: second.go", "+package fixture",
    ...Array.from({ length: 6 }, (_, index) => `+var config${index} = Config{ClientSecret: ${goReference},}`),
    "*** End Patch",
  ].join("\n");
  assertAssignmentBlocked(evaluateHook(preToolEvent(repositoryRoot, "apply_patch", { command: mixed })));
});

test("Go fragments without a package and multi-hunk update patches retain SG007", () => {
  const assignment = `ClientSecret: ${goReference},`;
  for (const fragment of [`var config = Config{${assignment}}`, `return Config{${assignment}}`, `config := Config{${assignment}}`]) {
    assertAssignmentBlocked(checkNewSource(fragment, "auth.go"));
  }
  const command = ["*** Begin Patch", "*** Update File: auth.go", "@@", "+package fixture", "@@", `+var config = Config{${assignment}}`, "*** End Patch"].join("\n");
  assertAssignmentBlocked(evaluateHook(preToolEvent(repositoryRoot, "apply_patch", { command })));
});

test("Go process syntax classification is strict and subprocess boundaries are explicit", () => {
  const result = checkGoSyntax("package fixture", { remaining: 1 }, (executable, args, options) => {
    assert.equal(executable, "/trusted/gofmt");
    assert.deepEqual(args, []);
    assert.deepEqual(options.env, {});
    assert.deepEqual(options.stdio, ["pipe", "ignore", "pipe"]);
    assert.equal(options.timeout, 300);
    assert.equal(options.killSignal, "SIGKILL");
    assert.equal(options.maxBuffer, 65536);
    return { status: 0, stderr: "" };
  }, "/trusted/gofmt");
  assert.equal(result, true);
  const diagnostic = "<standard input>:4:30: illegal character U+0040 '@'\n";
  assert.equal(checkGoSyntax("package fixture\nvar x = @", { remaining: 1 }, () => ({ status: 2, stderr: diagnostic }), "/trusted/gofmt"), false);
});

test("Go package precondition skips only leading BOM, whitespace and comments", () => {
  const prefixes = ["", "\uFEFF", " \t\r\n", "// license\n", "/* license */\n//go:build linux\n\n"];
  for (const prefix of prefixes) {
    assert.equal(hasGoPackageClause(prefix + goSource()), true);
    assert.deepEqual(checkNewSource(prefix + goSource(), "auth.go"), {});
  }
  for (const source of ['"package fixture"', '`package fixture`', "// package fixture", "/* package fixture */", "/* unterminated package fixture", "packageπ := Config{}", "var packageπ = Config{}"] ) {
    assert.equal(hasGoPackageClause(source), false);
  }
  assertAssignmentBlocked(checkNewSource(`packageπ := Config{ClientSecret: ${goReference},}`, "auth.go"));
});

test("Go formatter resolution rejects wrappers, repository binaries and missing paths", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "kiwi-parser-resolution-"));
  const native = path.join(directory, "gofmt");
  const wrapper = path.join(directory, "wrapper");
  const repository = path.join(directory, "repository");
  mkdirSync(repository);
  mkdirSync(path.join(repository, ".git"));
  const local = path.join(repository, "gofmt");
  const link = path.join(directory, "repository-link");
  try {
    const magic = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);
    writeFileSync(native, magic, { mode: 0o755 });
    writeFileSync(local, magic, { mode: 0o755 });
    writeFileSync(wrapper, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    symlinkSync(local, link);
    assert.equal(resolveGoFormatter([native]), native);
    assert.equal(resolveGoFormatter([wrapper, local, link, path.join(directory, "missing")]), null);
    const previous = process.env.GOROOT;
    try {
      process.env.GOROOT = "relative-toolchain";
      assert.deepEqual(goFormatterCandidates(), ["/usr/local/go/bin/gofmt", "/usr/bin/gofmt"]);
      process.env.GOROOT = directory;
      assert.equal(goFormatterCandidates()[0], path.join(directory, "bin/gofmt"));
    } finally {
      if (previous === undefined) delete process.env.GOROOT;
      else process.env.GOROOT = previous;
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("unknown modified Go syntax and oversized input cannot grant a transport exception", () => {
  let checks = 0;
  assertAssignmentBlocked(evaluateHook(preToolEvent(repositoryRoot, "apply_patch", {
    command: newSourcePatch(goSource(), "auth.go"),
  }), () => ++checks === 1 ? true : null));
  assert.equal(checks, 2);
  assert.equal(checkGoSyntax("x".repeat(8 * 1024 * 1024 + 1), { remaining: 12 }, () => { throw new Error("must not run"); }, "/trusted/gofmt"), null);
});

test("unknown Go parser outcomes retain SG007 through repository scan policy", () => {
  const fixture = createRepository();
  try {
    writeFileSync(path.join(fixture.repository, "auth.go"), goSource());
    runGit(fixture.repository, ["add", "auth.go"]);
    for (const initialValid of [false, true]) {
      let checks = 0;
      const findings = scanRepository(fixture.repository, {
        remaining: 12,
        checkGoSyntax() { return initialValid && ++checks === 1 ? true : null; },
      });
      assert.equal(findings.some((item) => item.ruleId === "SG007-credential-assignment"), true);
    }
  } finally { fixture.cleanup(); }
});

test("Go repository scans prove complete staged, committed and unstaged source", () => {
  const fixture = createRepository();
  try {
    writeFileSync(path.join(fixture.repository, "auth.go"), goSource());
    runGit(fixture.repository, ["add", "auth.go"]);
    assert.deepEqual(scanRepository(fixture.repository), []);
    runGit(fixture.repository, ["commit", "-m", "Add Go configuration reference"]);
    assert.deepEqual(scanRepository(fixture.repository), []);
    runGit(fixture.repository, ["push"]);
    writeFileSync(path.join(fixture.repository, "auth.go"), "// Café 🙂\n" + goSource());
    assert.deepEqual(scanRepository(fixture.repository), []);
  } finally { fixture.cleanup(); }
});

function assertAssignmentBlocked(result) {
  assert.equal(result.hookSpecificOutput.permissionDecision, "deny");
  assert.match(JSON.stringify(result), /SG007-credential-assignment/);
}

test("allows syntactic runtime references in a complete new JavaScript module", () => {
  const references = [
    runtimeReference,
    ["process", "env", "OPENAI_API_KEY"].join("."),
    ["env", "RUNTIME_API_KEY"].join("."),
  ];
  const source = [
    'import { readFile } from "node:fs/promises";',
    ...references.map((value, index) => `const config${index} = { apiKey: ${value} };`),
  ].join("\n");

  assert.deepEqual(checkNewSource(source), {});
});

test("quoted references and literal credentials remain blocked", () => {
  for (const quote of ['"', "'", "`"]) {
    assertAssignmentBlocked(checkNewSource(
      `const config = { apiKey: ${quote}${runtimeReference}${quote} };`,
    ));
  }
  const candidate = "A".repeat(24);
  const result = checkNewSource(`const config = { password: "${candidate}" };`);
  assertAssignmentBlocked(result);
  assert.equal(JSON.stringify(result).includes(candidate), false);
});

test("references inside comments, strings, regexes and templates are still data", () => {
  const assignment = `apiKey: ${runtimeReference},`;
  const sources = [
    `// ${assignment}`,
    `/*\n${assignment}\n*/`,
    `const text = "${assignment}";`,
    `const text = \`\n${assignment}\n\`;`,
    `const pattern = /${assignment}/;`,
    `const pattern = /[${assignment}]/u;`,
    `const template = \`outer \${\`inner\`}\n${assignment}\`;`,
  ];

  for (const source of sources) {
    assertAssignmentBlocked(checkNewSource(source));
  }
});

test("unknown contexts, incomplete patches and invalid source fail closed", () => {
  const assignment = `apiKey: ${runtimeReference}`;
  for (const filePath of ["config.json", "config.yaml", "README.md"]) {
    assertAssignmentBlocked(checkNewSource(assignment, filePath));
  }
  assertAssignmentBlocked(checkNewSource(`const config = { ${assignment}`));
  assertAssignmentBlocked(evaluateHook(preToolEvent(repositoryRoot, "Bash", {
    command: `echo '${assignment}'`,
  })));
  assertAssignmentBlocked(evaluateHook(preToolEvent(repositoryRoot, "apply_patch", {
    command: [
      "*** Begin Patch", "*** Update File: existing.mjs", "@@",
      `+const config = { ${assignment} };`, "*** End Patch",
    ].join("\n"),
  })));
  const prompt = evaluateHook({
    hook_event_name: "UserPromptSubmit", cwd: repositoryRoot, prompt: assignment,
  });
  assert.equal(prompt.decision, "block");
});

test("syntax validation does not execute source or inherit Node loader options", () => {
  const previous = process.env.NODE_OPTIONS;
  process.env.NODE_OPTIONS = "--require=/missing/guard-test-loader.cjs";
  try {
    assert.deepEqual(checkNewSource([
      'import "module-that-must-not-be-loaded";',
      'throw new Error("source must never execute");',
      `const config = { apiKey: ${runtimeReference} };`,
    ].join("\n")), {});
  } finally {
    if (previous === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = previous;
  }
});

test("runtime allowance never exempts provider-shaped values elsewhere", () => {
  const candidate = ["github", "_pat_", "A".repeat(36)].join("");
  const result = checkNewSource([
    `const config = { apiKey: ${runtimeReference} };`,
    `const other = "${candidate}";`,
  ].join("\n"));

  assert.equal(result.hookSpecificOutput.permissionDecision, "deny");
  assert.match(JSON.stringify(result), /SG004-provider-token/);
  assert.equal(JSON.stringify(result).includes(candidate), false);
});

test("syntax checks have a per-hook budget and exhaustion fails closed", () => {
  const source = Array.from({ length: 15 }, (_, index) =>
    `const config${index} = { apiKey: ${runtimeReference} };`,
  ).join("\n");
  assertAssignmentBlocked(checkNewSource(source));
});

test("repository scans use complete staged, committed and unstaged JavaScript", () => {
  const fixture = createRepository();
  const filePath = path.join(fixture.repository, "launcher.mjs");
  const assignment = `apiKey: ${runtimeReference},`;
  try {
    writeFileSync(filePath, `const config = {\n${assignment}\n};\n`);
    runGit(fixture.repository, ["add", "launcher.mjs"]);
    assert.deepEqual(scanRepository(fixture.repository), []);
    runGit(fixture.repository, ["commit", "-m", "Add runtime reference"]);
    assert.deepEqual(scanRepository(fixture.repository), []);
    runGit(fixture.repository, ["push"]);
    const changed = assignment.replace("INTEGRATIONS", "RUNTIME");
    writeFileSync(filePath, `const text = \`\n${changed}\n\`;\n`);
    const findings = scanRepository(fixture.repository);
    assert.equal(findings.some((item) => item.ruleId === "SG007-credential-assignment"), true);
  } finally {
    fixture.cleanup();
  }
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  evaluateHook,
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

#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_FINDINGS = 5;
const MAX_JAVASCRIPT_CHECKS = 12;
const JAVASCRIPT_CHECK_TIMEOUT_MS = 300;
const PRIVATE_KEY_PATTERN = new RegExp([
  "-----BEGIN ",
  "(?:(?:OPENSSH|RSA|EC|DSA) )?",
  "PRIVATE KEY-----",
  "|",
  "-----BEGIN PGP ",
  "PRIVATE KEY BLOCK-----",
].join(""), "i");

const SECRET_PATTERNS = [
  {
    ruleId: "SG001-private-key",
    pattern: PRIVATE_KEY_PATTERN,
  },
  {
    ruleId: "SG002-jwt",
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  },
  {
    ruleId: "SG003-bearer-token",
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/i,
  },
  {
    ruleId: "SG004-provider-token",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{32,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|sk_live_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16})\b/,
  },
  {
    ruleId: "SG005-webhook-signature",
    pattern: /https?:\/\/[^\s"'<>]{0,300}(?:sig|signature|token|key)=[A-Za-z0-9%._~+/-]{16,}/i,
  },
  {
    ruleId: "SG006-credentialed-url",
    pattern: /https?:\/\/[^\s/:@]{1,80}:[^\s/@]{8,}@[^\s/]+/i,
  },
];

const CREDENTIAL_ASSIGNMENT = /\b(?:api[_-]?key|client[_-]?secret|password|passwd|access[_-]?token|refresh[_-]?token|secret)\b\s*[:=]\s*(["'`]?)([A-Za-z0-9._~+/=-]{16,})/gi;
const PLACEHOLDER_VALUE = /^(?:x+|example|placeholder|redacted|changeme|replace[-_]?me|your[-_].*)$/i;
const SAFE_ENV_FILES = new Set([
  ".env.example",
  ".env.dist",
  ".env.sample",
  ".env.template",
]);
const FORBIDDEN_BASENAMES = new Set([
  ".env",
  ".envrc",
  ".netrc",
  ".npmrc",
  ".pypirc",
  "client_secrets.json",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "id_rsa",
  "keys.txt",
  "kubeconfig",
]);
const SECRET_FILE_MENTION = /(?:^|[\s"'=])(?:\.env(?:\.[A-Za-z0-9_-]+)?|\.envrc|\.netrc|\.npmrc|\.pypirc|client_secrets\.json|id_(?:dsa|ecdsa|ed25519|rsa)|keys\.txt|kubeconfig|[^\s"']+\.(?:key|p12|pfx))(?=$|[\s"';&|<>])/i;
const SECRET_FILE_READER = /(?:^|[;&|]\s*)(?:(?:sudo|env)\s+)*(?:awk|cat|cp|curl|grep|head|install|less|more|mv|rg|sed|source|tail)\b|(?:^|[;&|]\s*)\.\s+/i;
const GIT_SECRET_READER = /\bgit\s+(?:-[^\s]+\s+)*(?:diff|show)\b/i;
const FORCE_ADD = /\bgit\s+(?:-[^\s]+\s+)*add\b[^;&|]*(?:\s-f(?:\s|$)|\s--force(?:\s|$))/i;
const PUBLICATION_COMMAND = /\bgit\s+(?:-[^\s]+\s+)*push\b|\bgh\s+pr\s+create\b/i;
const GITHUB_PUBLICATION_TOOLS = new Set([
  "mcp__codex_apps__github_create_blob",
  "mcp__codex_apps__github_create_commit",
  "mcp__codex_apps__github_create_file",
  "mcp__codex_apps__github_create_pull_request",
  "mcp__codex_apps__github_create_tree",
  "mcp__codex_apps__github_update_file",
  "mcp__codex_apps__github_update_ref",
]);
const PATH_FIELD_NAMES = new Set([
  "file_name",
  "file_path",
  "filename",
  "path",
]);

function finding(ruleId, source) {
  return { ruleId, source: safeSource(source) };
}

function safeSource(source) {
  const normalized = String(source).replaceAll("\\", "/");
  const safe = normalized.replace(/[^A-Za-z0-9._/@<>-]/g, "?");
  return safe.slice(0, 160) || "<unknown>";
}

function uniqueFindings(findings) {
  const seen = new Set();
  const result = [];

  for (const item of findings) {
    const key = `${item.ruleId}:${item.source}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);

    if (result.length === MAX_FINDINGS) {
      break;
    }
  }

  return result;
}

function javascriptContext(text, filePath, budget) {
  if (!/\.(?:js|mjs|cjs)$/.test(filePath)) {
    return null;
  }

  return { text, budget, valid: null };
}

function checkJavaScript(text, budget) {
  if (budget.remaining === 0) {
    return null;
  }
  budget.remaining -= 1;

  // Syntax checking never evaluates source or imports. An empty environment
  // prevents NODE_OPTIONS from injecting a loader into this security check.
  const result = spawnSync(process.execPath, ["--check", "--input-type=module"], {
    input: text,
    encoding: "utf8",
    env: {},
    timeout: JAVASCRIPT_CHECK_TIMEOUT_MS,
    maxBuffer: MAX_INPUT_BYTES,
  });

  if (result.error || result.signal) {
    return null;
  }
  if (result.status === 0) {
    return true;
  }
  return result.status === 1 && /SyntaxError:/.test(result.stderr) ? false : null;
}

function isRuntimeReference(match, text, context, offset) {
  const [assignment, quote, value] = match;
  const isEnvironmentReference = /^(?:process\.env|source|env)\.[A-Z][A-Z0-9_]+$/.test(value);
  const hasExpressionBoundary = /^(?:\s*[,;})]|\s*$)/.test(text.slice(match.index + assignment.length));
  if (quote || !isEnvironmentReference || !hasExpressionBoundary || !context) {
    return false;
  }
  if (context.text.slice(offset, offset + text.length) !== text) {
    return false;
  }
  if (context.valid === null) {
    context.valid = checkJavaScript(context.text, context.budget);
  }
  if (context.valid !== true) {
    return false;
  }

  // A filename or a matching spelling cannot prove that a reference is code.
  // Replacing it with @ breaks JavaScript syntax, but stays ordinary text in
  // strings, templates, comments and regex literals. Ambiguity fails closed.
  const valueStart = offset + match.index + assignment.length - value.length;
  const modified = context.text.slice(0, valueStart)
    + "@" + context.text.slice(valueStart + value.length);
  return checkJavaScript(modified, context.budget) === false;
}

export function findSensitiveData(text, source = "<input>", context = null, offset = 0) {
  if (typeof text !== "string" || text.length === 0) {
    return [];
  }

  const findings = [];

  for (const rule of SECRET_PATTERNS) {
    if (rule.pattern.test(text)) {
      findings.push(finding(rule.ruleId, source));
    }
  }

  CREDENTIAL_ASSIGNMENT.lastIndex = 0;
  for (const match of text.matchAll(CREDENTIAL_ASSIGNMENT)) {
    if (!PLACEHOLDER_VALUE.test(match[2]) && !isRuntimeReference(match, text, context, offset)) {
      findings.push(finding("SG007-credential-assignment", source));
      break;
    }
  }

  return uniqueFindings(findings);
}

export function isForbiddenPath(filePath) {
  const normalized = String(filePath).replaceAll("\\", "/").toLowerCase();
  const basename = path.posix.basename(normalized);

  if (SAFE_ENV_FILES.has(basename)) {
    return false;
  }

  const isEnvironmentFile = basename.startsWith(".env.");
  const hasPrivateKeyExtension = /\.(?:key|p12|pfx)$/.test(basename);
  const isNamedPrivatePem = /(?:private|identity|id_[a-z0-9_-]+).*\.pem$/.test(basename);
  const isKubeconfig = basename.endsWith(".kubeconfig");

  return FORBIDDEN_BASENAMES.has(basename)
    || isEnvironmentFile
    || hasPrivateKeyExtension
    || isNamedPrivatePem
    || isKubeconfig;
}

function scanPath(filePath) {
  if (!isForbiddenPath(filePath)) {
    return [];
  }

  return [finding("SG008-sensitive-path", filePath)];
}

function pathFromPatchHeader(line) {
  const fileMatch = line.match(/^\*\*\* (Add|Update) File:\s*(.+)$/);
  const moveMatch = line.match(/^\*\*\* Move to:\s*(.+)$/);

  if (moveMatch) {
    return {
      filePath: moveMatch[1].trim(),
      isNew: true,
    };
  }

  if (!fileMatch) {
    return null;
  }

  return {
    filePath: fileMatch[2].trim(),
    isNew: fileMatch[1] === "Add",
  };
}

function scanAddedSource(lines, filePath, complete, budget) {
  const text = lines.map((line) => line.text).join("\n");
  const context = complete ? javascriptContext(text, filePath, budget) : null;
  const findings = [];
  let offset = 0;

  for (const line of lines) {
    if (line.added) {
      findings.push(...findSensitiveData(line.text, filePath, context, offset));
    }
    offset += line.text.length + 1;
  }

  return findings;
}

function scanPatch(patch, budget) {
  const findings = [];
  let currentPath = "<patch>";
  let isNewFile = false;
  let lines = [];

  function flush() {
    findings.push(...scanAddedSource(lines, currentPath, isNewFile, budget));
    lines = [];
  }

  for (const line of patch.split(/\r?\n/)) {
    const header = pathFromPatchHeader(line);
    if (header !== null) {
      flush();
      currentPath = header.filePath;
      isNewFile = line.startsWith("*** Add File:");
      if (header.isNew) {
        findings.push(...scanPath(currentPath));
      }
      continue;
    }

    if (line.startsWith("+")) {
      lines.push({ text: line.slice(1), added: true });
    }
  }
  flush();

  return uniqueFindings(findings);
}

function scanDiff(diff, budget) {
  const findings = [];
  let currentPath = "<diff>";
  let isNewFile = false;
  let lines = [];
  let hunkCount = 0;
  let startsAtBeginning = false;

  function flush() {
    const complete = hunkCount === 1 && startsAtBeginning;
    findings.push(...scanAddedSource(lines, currentPath, complete, budget));
    lines = [];
    hunkCount = 0;
    startsAtBeginning = false;
  }

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      flush();
      isNewFile = false;
      currentPath = "<diff>";
      continue;
    }
    if (line.startsWith("new file mode ")) {
      isNewFile = true;
      continue;
    }
    if (line.startsWith("rename to ")) {
      currentPath = line.slice("rename to ".length).trim();
      findings.push(...scanPath(currentPath));
      continue;
    }
    if (line.startsWith("+++ b/") && hunkCount === 0) {
      currentPath = line.slice(6).trim();
      if (isNewFile) {
        findings.push(...scanPath(currentPath));
      }
      continue;
    }
    if (line.startsWith("@@ ")) {
      hunkCount += 1;
      startsAtBeginning = /^@@ -[0-9]+(?:,[0-9]+)? \+1(?:,[0-9]+)? @@/.test(line);
      continue;
    }
    if (hunkCount > 0 && (line.startsWith("+") || line.startsWith(" "))) {
      lines.push({ text: line.slice(1), added: line.startsWith("+") });
    }
  }
  flush();

  return uniqueFindings(findings);
}

function runGit(cwd, args, allowFailure = false) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: MAX_INPUT_BYTES,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args[0]} failed`);
  }

  return result.status === 0 ? result.stdout : null;
}

function findRepositoryRoot(cwd) {
  const root = runGit(cwd, ["rev-parse", "--show-toplevel"]);
  return root.trim();
}

function scanUntrackedPaths(repositoryRoot) {
  const findings = [];
  const untracked = runGit(repositoryRoot, ["ls-files", "--others", "--exclude-standard", "-z"]);

  for (const filePath of untracked.split("\0")) {
    if (filePath) {
      findings.push(...scanPath(filePath));
    }
  }

  return findings;
}

function findComparisonRef(repositoryRoot) {
  const upstream = runGit(
    repositoryRoot,
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    true,
  );

  if (upstream) {
    return upstream.trim();
  }

  const originMain = runGit(repositoryRoot, ["rev-parse", "--verify", "origin/main"], true);
  return originMain ? "origin/main" : null;
}

export function scanRepository(cwd, budget = { remaining: MAX_JAVASCRIPT_CHECKS }) {
  const repositoryRoot = findRepositoryRoot(cwd);
  const diffArguments = ["diff", "--no-ext-diff", "--unified=2147483647", "--diff-filter=ACMR"];
  const findings = scanUntrackedPaths(repositoryRoot);

  findings.push(...scanDiff(runGit(repositoryRoot, [...diffArguments, "--"]), budget));
  findings.push(...scanDiff(runGit(repositoryRoot, [...diffArguments, "--cached", "--"]), budget));

  const comparisonRef = findComparisonRef(repositoryRoot);
  if (comparisonRef) {
    findings.push(...scanDiff(runGit(
      repositoryRoot,
      [...diffArguments, `${comparisonRef}...HEAD`, "--"],
    ), budget));
  }

  return uniqueFindings(findings);
}

function stringsFrom(value) {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(stringsFrom);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(stringsFrom);
  }

  return [];
}

function pathsFromToolInput(value) {
  if (Array.isArray(value)) {
    return value.flatMap(pathsFromToolInput);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const paths = [];

  for (const [key, nestedValue] of Object.entries(value)) {
    if (PATH_FIELD_NAMES.has(key) && typeof nestedValue === "string") {
      paths.push(nestedValue);
    }
    paths.push(...pathsFromToolInput(nestedValue));
  }

  return paths;
}

function scanToolInput(toolInput) {
  const findings = [];

  for (const value of stringsFrom(toolInput)) {
    findings.push(...findSensitiveData(value, "<tool-input>"));
  }

  return uniqueFindings(findings);
}

function validateToolCommand(event) {
  const command = event.tool_input?.command;

  if (typeof command !== "string") {
    throw new Error(`${event.tool_name} input has no command`);
  }

  return command;
}

function evaluateBashBeforeUse(event, budget) {
  const command = validateToolCommand(event);
  const findings = findSensitiveData(command, "<shell-command>");
  const mentionsSecretFile = SECRET_FILE_MENTION.test(command);
  const readsSecretFile = SECRET_FILE_READER.test(command) || GIT_SECRET_READER.test(command);

  if (mentionsSecretFile && readsSecretFile) {
    findings.push(finding("SG009-sensitive-file-read", "<shell-command>"));
  }

  if (FORCE_ADD.test(command)) {
    findings.push(finding("SG010-force-add", "<shell-command>"));
  }

  if (PUBLICATION_COMMAND.test(command)) {
    findings.push(...scanRepository(event.cwd, budget));
  }

  return uniqueFindings(findings);
}

function evaluateBeforeToolUse(event, budget) {
  if (event.tool_name === "Bash") {
    return evaluateBashBeforeUse(event, budget);
  }

  if (event.tool_name === "apply_patch") {
    return scanPatch(validateToolCommand(event), budget);
  }

  const findings = scanToolInput(event.tool_input);
  for (const filePath of pathsFromToolInput(event.tool_input)) {
    findings.push(...scanPath(filePath));
  }

  if (GITHUB_PUBLICATION_TOOLS.has(event.tool_name)) {
    findings.push(...scanRepository(event.cwd, budget));
  }

  return uniqueFindings(findings);
}

function evaluateAfterToolUse(event, budget) {
  validateToolCommand(event);
  return scanRepository(event.cwd, budget);
}

function formatReason(findings) {
  const details = findings
    .map((item) => `${item.ruleId} at ${item.source}`)
    .join(", ");

  return `Sensitive-data guard found ${findings.length} issue(s): ${details}. Remove the sensitive value or path before continuing.`;
}

function blockedOutput(event, findings) {
  const reason = formatReason(findings);

  if (event.hook_event_name === "PreToolUse") {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    };
  }

  if (event.hook_event_name === "PostToolUse") {
    return {
      decision: "block",
      reason,
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: reason,
      },
    };
  }

  if (event.hook_event_name === "Stop" && event.stop_hook_active) {
    return {
      continue: false,
      stopReason: reason,
      systemMessage: reason,
    };
  }

  return { decision: "block", reason };
}

export function evaluateHook(event) {
  if (!event || typeof event !== "object" || typeof event.hook_event_name !== "string") {
    throw new Error("Invalid hook input");
  }

  let findings;
  const budget = { remaining: MAX_JAVASCRIPT_CHECKS };

  switch (event.hook_event_name) {
    case "UserPromptSubmit":
      if (typeof event.prompt !== "string") {
        throw new Error("UserPromptSubmit input has no prompt");
      }
      findings = findSensitiveData(event.prompt, "<prompt>");
      break;
    case "PreToolUse":
      findings = evaluateBeforeToolUse(event, budget);
      break;
    case "PostToolUse":
      findings = evaluateAfterToolUse(event, budget);
      break;
    case "Stop":
      findings = scanRepository(event.cwd, budget);
      break;
    default:
      throw new Error("Unsupported hook event");
  }

  return findings.length === 0 ? {} : blockedOutput(event, findings);
}

async function readHookInput() {
  const chunks = [];
  let size = 0;

  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > MAX_INPUT_BYTES) {
      throw new Error("Hook input is too large");
    }
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function main() {
  try {
    const event = await readHookInput();
    process.stdout.write(`${JSON.stringify(evaluateHook(event))}\n`);
  } catch {
    process.stderr.write("Sensitive-data guard failed closed because the hook input or repository state could not be validated.\n");
    process.exitCode = 2;
  }
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedAsScript) {
  await main();
}

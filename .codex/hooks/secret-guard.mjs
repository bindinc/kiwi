#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_FINDINGS = 5;
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

const CREDENTIAL_ASSIGNMENT = /\b(?:api[_-]?key|client[_-]?secret|password|passwd|access[_-]?token|refresh[_-]?token|secret)\b\s*[:=]\s*["']?([A-Za-z0-9._~+/=-]{16,})/gi;
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

export function findSensitiveData(text, source = "<input>") {
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
    if (!PLACEHOLDER_VALUE.test(match[1])) {
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

function scanPatch(patch) {
  const findings = [];
  let currentPath = "<patch>";

  for (const line of patch.split(/\r?\n/)) {
    const header = pathFromPatchHeader(line);
    if (header !== null) {
      currentPath = header.filePath;
      if (header.isNew) {
        findings.push(...scanPath(currentPath));
      }
      continue;
    }

    const isAddedLine = line.startsWith("+") && !line.startsWith("+++");
    if (isAddedLine) {
      findings.push(...findSensitiveData(line.slice(1), currentPath));
    }
  }

  return uniqueFindings(findings);
}

function scanDiff(diff) {
  const findings = [];
  let currentPath = "<diff>";
  let isNewFile = false;

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      isNewFile = false;
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

    if (line.startsWith("+++ b/")) {
      currentPath = line.slice(6).trim();
      if (isNewFile) {
        findings.push(...scanPath(currentPath));
      }
      continue;
    }

    const isAddedLine = line.startsWith("+") && !line.startsWith("+++");
    if (isAddedLine) {
      findings.push(...findSensitiveData(line.slice(1), currentPath));
    }
  }

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

export function scanRepository(cwd) {
  const repositoryRoot = findRepositoryRoot(cwd);
  const diffArguments = ["diff", "--no-ext-diff", "--unified=0", "--diff-filter=ACMR"];
  const findings = scanUntrackedPaths(repositoryRoot);

  findings.push(...scanDiff(runGit(repositoryRoot, [...diffArguments, "--"])));
  findings.push(...scanDiff(runGit(repositoryRoot, [...diffArguments, "--cached", "--"])));

  const comparisonRef = findComparisonRef(repositoryRoot);
  if (comparisonRef) {
    findings.push(...scanDiff(runGit(
      repositoryRoot,
      [...diffArguments, `${comparisonRef}...HEAD`, "--"],
    )));
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

function evaluateBashBeforeUse(event) {
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
    findings.push(...scanRepository(event.cwd));
  }

  return uniqueFindings(findings);
}

function evaluateBeforeToolUse(event) {
  if (event.tool_name === "Bash") {
    return evaluateBashBeforeUse(event);
  }

  if (event.tool_name === "apply_patch") {
    return scanPatch(validateToolCommand(event));
  }

  const findings = scanToolInput(event.tool_input);
  for (const filePath of pathsFromToolInput(event.tool_input)) {
    findings.push(...scanPath(filePath));
  }

  if (GITHUB_PUBLICATION_TOOLS.has(event.tool_name)) {
    findings.push(...scanRepository(event.cwd));
  }

  return uniqueFindings(findings);
}

function evaluateAfterToolUse(event) {
  validateToolCommand(event);
  return scanRepository(event.cwd);
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

  switch (event.hook_event_name) {
    case "UserPromptSubmit":
      if (typeof event.prompt !== "string") {
        throw new Error("UserPromptSubmit input has no prompt");
      }
      findings = findSensitiveData(event.prompt, "<prompt>");
      break;
    case "PreToolUse":
      findings = evaluateBeforeToolUse(event);
      break;
    case "PostToolUse":
      findings = evaluateAfterToolUse(event);
      break;
    case "Stop":
      findings = scanRepository(event.cwd);
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

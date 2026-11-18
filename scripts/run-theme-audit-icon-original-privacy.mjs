#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { redactIconProcessOutput as sanitize } from './theme-audit-icon-log-redaction.mjs';

// theme_audit: execute the unchanged original privacy program; sanitize child output in memory before retaining or printing it.
const output = process.env.KIWI_FEEDBACK_EVIDENCE_DIR;
assert.match(output || '', /^\/home\/bartdeijkers\/_worktrees\/\.kiwi-theme-audit\/evidence\/\d{4}-\d{2}-\d{2}\/icon-refinement\//);
const original = fileURLToPath(new URL('./compose-smoke-feedback-privacy.mjs', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(await readFile(original)), 'f3e58cf266794c156f10d90cd5ae5c71c884c5844bf2d7eb4a3aff85b8f6fc9d');
const result = spawnSync(process.execPath, [original], { env: process.env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
await mkdir(output, { recursive: true });
const stdout = sanitize(result.stdout), stderr = sanitize(result.stderr);
await writeFile(path.join(output, 'stdout.sanitized.log'), stdout);
await writeFile(path.join(output, 'stderr.sanitized.log'), stderr);
const report = { marker: 'theme_audit', kind: 'Current icon155 candidate; unchanged original privacy assertions through explicit fresh216-body Privacy09 compatibility release.',
    browser: process.env.KIWI_SMOKE_BROWSER, original: { path: original, sha256: hash(await readFile(original)) },
    release: { path: process.env.KIWI_THEME_AUDIT_PRIVACY09_RELEASE, sha256: process.env.KIWI_THEME_AUDIT_PRIVACY09_RELEASE_SHA256 },
    originalExitCode: result.status, signal: result.signal, launchError: result.error ? sanitize(result.error.message) : null,
    stdoutSha256: hash(stdout), stderrSha256: hash(stderr), completedUtc: new Date().toISOString(),
    limitation: 'Only actual successful original scopes can be accepted. No modified SDK/assertion/fidelity threshold or blanket UI/native/role acceptance.' };
await writeFile(path.join(output, 'original-run.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ browser: report.browser, originalExitCode: result.status, output, launchError: report.launchError }));
process.exitCode = result.status === 0 && !result.error ? 0 : 1;

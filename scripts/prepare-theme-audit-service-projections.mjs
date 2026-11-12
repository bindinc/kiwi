#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// theme_audit: prepare source-derived response fixtures without real service writes.
const sourceRoot = process.env.KIWI_THEME_APP_ROOT, inputReport = process.env.KIWI_THEME_SERVICE_SOURCE_REPORT;
const evidenceDir = process.env.KIWI_THEME_EVIDENCE_DIR, project = process.env.KIWI_THEME_SERVICE_COMPOSE_PROJECT;
if (!sourceRoot || !inputReport || !evidenceDir || !/^kiwi-theme-audit-\d+$/.test(project || '')) throw new Error('Explicit source, recorded synthetic report, durable evidence and isolated theme Compose project are required.');
const hashes = value => createHash('sha256').update(value).digest('hex');
const reportText = await readFile(inputReport, 'utf8'), report = JSON.parse(reportText);
if (report.marker !== 'theme_audit' || report.slice !== 7 || report.serviceEvidence.customer.id !== 990701) throw new Error('Expected the declared synthetic service07 fixture report.');
const byCase = new Map();
for (const entry of report.serviceEvidence.fixtureRequests) if (entry.case && !byCase.has(entry.case)) byCase.set(entry.case, entry);
if (byCase.size !== 9) throw new Error('Expected nine explicit service payload branches.');
const customer = { ...report.serviceEvidence.customer, articles: [], contactHistory: [], addressValidation: { status: 'confirmed' } };
customer.subscriptions = customer.subscriptions.map(subscription => subscription.id === 990713 ? { ...subscription, lastEdition: '2026-10-05' } : subscription);
const payload = { customer, cases: [...byCase.values()].map(({ case: name, payload }) => ({ case: name, payload })), recordedAt: '2026-11-11T12:00:00+00:00' };
const script = await readFile(new URL('./prepare-theme-audit-service-projections.php', import.meta.url), 'utf8');
const runtime = path.resolve(sourceRoot, '../.kiwi-theme-audit/runtime');
const config = ['compose', '-p', project, '-f', path.join(sourceRoot, 'docker-compose.yaml'), '-f', path.join(runtime, 'compose.yaml'), '-f', path.join(runtime, 'compose-' + project.split('-').at(-1) + '-image.yaml')];
const output = execFileSync('docker', [...config, 'exec', '-T', 'app', 'php', '/dev/stdin', Buffer.from(JSON.stringify(payload)).toString('base64')],
    { input: script, encoding: 'utf8', env: { ...process.env, GATEWAY_HTTPS_PORT: '9444' }, maxBuffer: 4 * 1024 * 1024 });
const result = JSON.parse(output);
if (Object.keys(result.cases || {}).length !== 9) throw new Error('Actual isolated projections did not return all nine cases.');
result.fixtureSourceReport = { path: inputReport, sha256: hashes(reportText) };
result.generator = { phpSha256: hashes(script), nodeSha256: hashes(await readFile(fileURLToPath(import.meta.url))) };
result.boundaries = ['Actual business projection response/customer shape only; no claim that address/OIDC/outbox database or upstream persistence was exercised.',
    'Each browser callback case uses a declared independent local queued acknowledgement with SessionOutbox.save/present envelope; no production policy is copied into application code.'];
await mkdir(evidenceDir, { recursive: true });
const file = path.join(evidenceDir, 'service-projections.json'); await writeFile(file, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ file, cases: Object.keys(result.cases), sourceSha256: result.backendSourceSha256, noDatabaseOrNetworkWrites: true }));

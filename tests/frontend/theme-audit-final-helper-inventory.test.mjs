import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { finalOwnedHelperPath, verifyFinalHelperFiles } from '../../scripts/compose-smoke-theme-audit-final-driver.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const fixtureParent = fileURLToPath(new URL('./.theme-audit-final-helpers-unit/', import.meta.url));
const owned = ['compose-smoke-theme-audit-icons.mjs', 'theme-audit-icon-guards.mjs', 'theme-audit-icon-log-redaction.mjs',
    'run-theme-audit-icon-original-privacy.mjs', 'prepare-theme-audit-service-projections.mjs', 'prepare-theme-audit-service-projections.php'];
async function fixture() {
    await mkdir(fixtureParent, { recursive: true });
    const root = await mkdtemp(path.join(fixtureParent, 'unit-'));
    await mkdir(path.join(root, 'scripts'));
    const entries = [];
    for (const filename of [...owned, 'README.md']) {
        const body = Buffer.from(filename.endsWith('.php') ? '<?php /* synthetic unit projection */' : '// Synthetic unit fixture: ' + filename);
        await writeFile(path.join(root, 'scripts', filename), body);
        if (filename !== 'README.md') entries.push({ path: 'scripts/' + filename, sha256: sha256(body), bytes: body.length });
    }
    return { root, helpers: { worktree: root, files: entries }, async close() { await rm(root, { recursive: true, force: true });
        await rmdir(fixtureParent).catch(error => { if (error.code !== 'ENOTEMPTY') throw error; }); } };
}

test('explicit owned families include icon guard/logger/runner and PHP projection, excluding unrelated files', () => {
    for (const name of owned) assert.equal(finalOwnedHelperPath('scripts/' + name), true, name);
    for (const name of ['README.md', 'unrelated.php', 'theme-audit-secret.env', 'nested/theme-audit-hidden.mjs']) {
        assert.equal(finalOwnedHelperPath('scripts/' + name), false, name);
    }
});

test('actual helper inventory verifies all owned files and rejects omission of the guard/logger/PHP generator', async () => {
    const f = await fixture();
    try {
        assert.equal((await verifyFinalHelperFiles(f.root, f.helpers)).length, owned.length);
        for (const filename of ['theme-audit-icon-guards.mjs', 'theme-audit-icon-log-redaction.mjs', 'prepare-theme-audit-service-projections.php']) {
            const incomplete = { ...f.helpers, files: f.helpers.files.filter(entry => entry.path !== 'scripts/' + filename) };
            await assert.rejects(verifyFinalHelperFiles(f.root, incomplete), /membership differs/);
        }
    } finally { await f.close(); }
});

test('changed guard/logger/PHP bytes and newly added family members cannot pass an old manifest', async () => {
    const f = await fixture();
    try {
        for (const filename of ['theme-audit-icon-guards.mjs', 'theme-audit-icon-log-redaction.mjs', 'prepare-theme-audit-service-projections.php']) {
            const location = path.join(f.root, 'scripts', filename), before = await readFile(location);
            await writeFile(location, Buffer.concat([before, Buffer.from(' changed')]));
            await assert.rejects(verifyFinalHelperFiles(f.root, f.helpers));
            await writeFile(location, before);
        }
        await writeFile(path.join(f.root, 'scripts/theme-audit-new-owner.mjs'), '// Synthetic new family member');
        await assert.rejects(verifyFinalHelperFiles(f.root, f.helpers), /membership differs/);
    } finally { await f.close(); }
});

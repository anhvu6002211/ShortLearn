import test from 'node:test'; import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('manifest uses only implemented platform permissions', async () => {
 const manifest=JSON.parse(await readFile(new URL('../dist/manifest.json', import.meta.url),'utf8'));
 assert.equal(manifest.manifest_version,3);
 assert.deepEqual(manifest.permissions,['storage','activeTab','tabCapture','offscreen']);
 assert.deepEqual(manifest.host_permissions,['https://www.youtube.com/*','https://www.tiktok.com/*','https://www.instagram.com/*']);
});

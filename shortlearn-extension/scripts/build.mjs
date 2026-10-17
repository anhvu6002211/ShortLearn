import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url);
await rm(new URL('dist/', root), { recursive: true, force: true });
await mkdir(new URL('dist/', root), { recursive: true });
await Promise.all([
  build({ entryPoints: [fileURLToPath(new URL('src/content/index.ts', root))], outfile: fileURLToPath(new URL('dist/content.js', root)), bundle: true, format: 'iife', platform: 'browser', target: 'chrome120' }),
  build({ entryPoints: [fileURLToPath(new URL('src/content/page.ts', root))], outfile: fileURLToPath(new URL('dist/page.js', root)), bundle: true, format: 'iife', platform: 'browser', target: 'chrome120' }),
  build({ entryPoints: [fileURLToPath(new URL('src/content/platformPage.ts', root))], outfile: fileURLToPath(new URL('dist/platform-page.js', root)), bundle: true, format: 'iife', platform: 'browser', target: 'chrome120' }),
  build({ entryPoints: [fileURLToPath(new URL('src/background/index.ts', root))], outfile: fileURLToPath(new URL('dist/background.js', root)), bundle: true, format: 'esm', platform: 'browser', target: 'chrome120' }),
  build({ entryPoints: [fileURLToPath(new URL('src/popup/index.ts', root))], outfile: fileURLToPath(new URL('dist/popup.js', root)), bundle: true, format: 'iife', platform: 'browser', target: 'chrome120' }),
  build({ entryPoints: [fileURLToPath(new URL('src/offscreen/index.ts', root))], outfile: fileURLToPath(new URL('dist/offscreen.js', root)), bundle: true, format: 'iife', platform: 'browser', target: 'chrome120' }),
  cp(new URL('manifest.json', root), new URL('dist/manifest.json', root)),
  cp(new URL('src/popup/index.html', root), new URL('dist/popup.html', root)),
  cp(new URL('src/offscreen/index.html', root), new URL('dist/offscreen.html', root)),
  cp(new URL('assets/', root), new URL('dist/assets/', root), { recursive: true }),
]);
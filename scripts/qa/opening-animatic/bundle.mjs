/** Shared esbuild+Playwright boot for the opening-animatic probe family.
 * Bundles the real renderer into one page bundle; the asset resolver is stubbed to the fixture map
 * so no dev server, project store or network is involved.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '../../..');
const entryTemplate = (imports, globalName) => `${imports.join('\n')}\nObject.assign(window, { ${globalName} });\n`;

export async function boot(options) {
  const { out, imports, globalName, viewport = { width: 900, height: 620 } } = options;
  const buildDir = path.join(out, '.build');
  fs.mkdirSync(buildDir, { recursive: true });
  const entry = path.join(buildDir, 'entry.ts');
  fs.writeFileSync(entry, entryTemplate(imports, globalName));
  await build({
    entryPoints: [entry],
    outfile: path.join(buildDir, 'probe.js'),
    bundle: true,
    platform: 'browser',
    format: 'iife',
    tsconfig: path.join(root, 'tsconfig.app.json'),
    logLevel: 'silent',
    plugins: [{
      name: 'fixture-resource-boundary',
      setup(b) {
        b.onResolve({ filter: /generatedAssetResourceResolver$/ }, () => ({ path: 'fixture-resolver', namespace: 'probe' }));
        b.onLoad({ filter: /.*/, namespace: 'probe' }, () => ({ contents: 'export function resolveAssetResourceUrl(id,{project}){return project.assets?.uploaded?.[id]?.dataUrl ?? null}\nexport const builtinGeneratedResourceIds = [];\nexport const generatedAssetResourceResolver = { resolveAssetResourceUrl, builtinGeneratedResourceIds };', loader: 'js' }));
      },
    }],
  });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error && error.message ? error.message : error)));
  await page.setContent('<main id="host" style="position:relative;width:768px;height:432px;background:#000"></main>');
  await page.addScriptTag({ path: path.join(buildDir, 'probe.js') });
  return { browser, context, page, errors, out, buildDir };
}

export function writePng(target, dataUrl) {
  fs.writeFileSync(target, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
}

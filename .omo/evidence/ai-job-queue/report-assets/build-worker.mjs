import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { isBuiltin } from 'node:module';
import { build } from 'vite';

const root = process.cwd();
assert.equal(root, '/home/main/.herdr/worktrees/rpg-zzu/worktree-ai-report-assets-0906');
const outDir = await mkdtemp(join(tmpdir(), 'report-assets-worker-build-'));
let proof;
try {
  await build({ root, configFile: false, envFile: false, publicDir: false,
    resolve: { alias: { '@': resolve(root, 'src') } },
    build: { outDir, target: 'esnext', minify: false, rollupOptions: { input: resolve(root, 'ai-job-worker.html') } },
    plugins: [{ name: 'report-assets-worker-boundary-proof', generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(item => item.type === 'chunk');
      const modules = chunks.flatMap(chunk => Object.keys(chunk.modules));
      const external = [...this.getModuleIds()].filter(id => this.getModuleInfo(id)?.isExternal);
      assert(modules.some(id => id.endsWith('/src/ai/jobs/reportAssets.mjs')));
      assert.deepEqual(modules.filter(id => /\/scripts\/lib\/aiJobs\//.test(id)), []);
      assert.deepEqual(external.filter(isBuiltin), []);
      assert.deepEqual(modules.filter(id => /__vite-browser-external/.test(id)), []);
      proof = { entry: 'ai-job-worker.html', chunks: chunks.length, modules: new Set(modules).size,
        reportAssetsIncluded: true, serverRuntimeModules: [], nodeExternals: [], browserExternalShims: [], publicAssetsCopied: false };
    } }],
  });
  await writeFile(resolve(root, '.omo/evidence/ai-job-queue/report-assets/worker-build.json'), JSON.stringify(proof, null, 2) + '\n');
} finally {
  await rm(outDir, { recursive: true, force: true });
  console.log('Owned temporary worker build removed:', outDir);
}

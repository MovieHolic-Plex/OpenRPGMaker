// Scoped verification driver: real Vitest config with owned cache, no bundled config
// temporary files in shared node_modules. Invoke from the adopted checkout root.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startVitest } from 'vitest/node';

const temporary = await mkdtemp(join(tmpdir(), 'task9-vitest-'));
let ctx;
try {
  ctx = await startVitest('test', ['test/playerBuild.test.ts'], {
    root: process.cwd(), config: 'vitest.config.ts', configLoader: 'runner',
    run: true, maxWorkers: 1, fileParallelism: false, silent: false,
  }, { cacheDir: join(temporary, 'cache'), envDir: false });
  assert(ctx.vite.config.cacheDir.startsWith(temporary + '/'));
  assert.equal(ctx.state.getFiles().length, 1);
  assert.equal(ctx.state.getFiles()[0].result.state, 'pass');
  assert.deepEqual(ctx.state.getUnhandledErrors(), []);
} finally {
  if (ctx) await ctx.close();
  await rm(temporary, { recursive: true, force: true });
  assert.equal(existsSync(temporary), false);
  console.log(JSON.stringify({ vitestClosed: Boolean(ctx), temporaryRemoved: true }));
}

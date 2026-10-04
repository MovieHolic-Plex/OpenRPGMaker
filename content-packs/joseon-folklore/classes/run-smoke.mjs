import { createServer } from 'vite';
import { ViteNodeServer } from 'vite-node/server';
import { ViteNodeRunner } from 'vite-node/client';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const cacheDir = `/tmp/jf-classes-smoke-${process.pid}`;
// configFile:false and envFile:false avoid the app's bridge plugins and private env.
// No server.listen(): this runner transforms local modules only.
const server = await createServer({
  root, configFile: false, envFile: false, cacheDir, logLevel: 'error',
  resolve: { alias: { '@': `${root}src` } },
  server: { watch: null, hmr: false, ws: false, middlewareMode: true },
});
try {
  await server.environments.client.pluginContainer.buildStart({});
  const node = new ViteNodeServer(server);
  const runner = new ViteNodeRunner({ root, fetchModule: id => node.fetchModule(id), resolveId: (id, importer) => node.resolveId(id, importer) });
  await runner.executeFile(fileURLToPath(new URL('./smoke.mts', import.meta.url)));
} finally {
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
}

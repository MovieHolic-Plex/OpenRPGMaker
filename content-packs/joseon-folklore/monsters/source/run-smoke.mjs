// Transform and execute only the data smoke; no dev listener or main config.
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { ViteNodeServer } from 'vite-node/server';
import { ViteNodeRunner } from 'vite-node/client';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const server = await createServer({
  root, configFile: false, envFile: false, logLevel: 'error',
  cacheDir: '/tmp/jf-monsters-vite-smoke',
  resolve: { alias: { '@': fileURLToPath(new URL('../../../../src', import.meta.url)) } },
  server: { hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const node = new ViteNodeServer(server);
  const runner = new ViteNodeRunner({
    root: server.config.root, base: server.config.base,
    fetchModule: id => node.fetchModule(id),
    resolveId: (id, importer) => node.resolveId(id, importer),
  });
  await runner.executeId('/@vite/env');
  await runner.executeFile(fileURLToPath(new URL('normalize-smoke.mts', import.meta.url)));
  await runner.executeFile(fileURLToPath(new URL('balance-probe.mts', import.meta.url)));
} finally {
  await server.close();
}

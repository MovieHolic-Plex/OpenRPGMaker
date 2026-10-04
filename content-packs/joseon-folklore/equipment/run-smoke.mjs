import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { ViteNodeServer } from 'vite-node/server';
import { ViteNodeRunner } from 'vite-node/client';

// Avoid the shared read-only node_modules/.vite-temp config bundling path.
// This individual smoke loads actual source modules without starting a web server.
const root = fileURLToPath(new URL('../../../',import.meta.url));
const server = await createServer({
  configFile:false, root, logLevel:'error',
  cacheDir:'/tmp/jf-equipment-pilot-vite-cache',
  resolve:{alias:{'@':fileURLToPath(new URL('../../../src',import.meta.url))}},
  server:{hmr:false,watch:null},
});
try {
  await server.environments.client.pluginContainer.buildStart({});
  const node = new ViteNodeServer(server);
  const runner = new ViteNodeRunner({root,
    fetchModule:id => node.fetchModule(id),
    resolveId:(id,importer) => node.resolveId(id,importer),
  });
  await runner.executeFile(fileURLToPath(new URL('./smoke.mts',import.meta.url)));
} finally {
  await server.close();
}

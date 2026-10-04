import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { ViteNodeServer } from "vite-node/server";
import { ViteNodeRunner } from "vite-node/client";

// Executes a single data smoke. Never listens, loads app config or connects storage.
// Shared node_modules is read-only; temp config bundling is deliberately disabled.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const server = await createServer({
  root, configFile: false, envFile: false, cacheDir: "/tmp/jf-consumables-script-cache",
  resolve: { alias: { "@": fileURLToPath(new URL("../../../src", import.meta.url)) } },
  server: { hmr: false, watch: null }, logLevel: "error",
});
try {
  await server.environments.client.pluginContainer.buildStart({});
  const node = new ViteNodeServer(server);
  const runner = new ViteNodeRunner({
    root, base: server.config.base,
    fetchModule: id => node.fetchModule(id),
    resolveId: (id, importer) => node.resolveId(id, importer),
  });
  await runner.executeFile(fileURLToPath(new URL("./smoke.mts", import.meta.url)));
} finally {
  await server.close();
}

import { createServer } from 'vite';
import path from 'node:path';
const server = await createServer({
  configFile: false, envFile: false,
  cacheDir: process.env.VITE_CACHE_DIR,
  resolve: { alias: { '@': path.resolve('src') } },
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
});
try {
  const module = await server.ssrLoadModule('/.omo/evidence/life-full-20260906/52/producer/public-probe.ts');
  module.runProbe();
} finally {
  await server.close();
  console.log('Public probe Vite module loader closed; no HTTP listener or browser was started.');
}

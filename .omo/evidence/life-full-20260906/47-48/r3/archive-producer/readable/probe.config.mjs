// NEW r3 non-listening vite-node configuration. External durable probe is explicitly allowed.
import { realpathSync } from 'node:fs';
const root = '/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3';
const evidence = '/home/main/z-project/rpg-zzu-life-full-p4/.omo/evidence/life-full-20260906/47-48/r3/producer';
export default {
  root,
  cacheDir: process.env.VITE_CACHE_DIR,
  resolve: { alias: { '@': `${root}/src` }, extensions: ['.ts', '.js'] },
  server: { middlewareMode: true, fs: { strict: true, allow: [root, evidence, realpathSync(`${root}/node_modules`)] } },
};

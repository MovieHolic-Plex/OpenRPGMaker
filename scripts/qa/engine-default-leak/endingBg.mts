
import { resolve } from 'node:path'; import { readdirSync } from 'node:fs';
import { openLocalProjectStore } from '../../../electron/local-store/store';
const base = process.argv[2]; const res: any[] = [];
for (const g of readdirSync(base).sort()) {
  const s = await openLocalProjectStore({ projectDir: resolve(base, g) });
  try {
    const p: any = s.loadSnapshot()!.project;
    const t = p.system?.titleScreen?.backgroundResourceId ?? p.system?.titleResourceId;
    const ends = p.endings ?? [];
    const bare = ends.filter((e: any) => !e.presentation?.backgroundResourceId);
    res.push({ g, endings: ends.length, bare: bare.length, bareOnDefaultTitle: t === 'oprn-title-field' ? bare.length : 0, titleBg: t });
  } finally { s.close(); }
}
console.log(JSON.stringify(res));

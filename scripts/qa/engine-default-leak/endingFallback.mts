
import { resolve } from 'node:path'; import { readdirSync } from 'node:fs';
import { openLocalProjectStore } from '../../../electron/local-store/store';
import { endingBackdropCandidates, factoryArtResourceIds } from '@/project/defaultLeaks';
const art = factoryArtResourceIds(); const rows: any[] = [];
for (const g of readdirSync(process.env.LEAK_BASE!).sort()) {
  const s = await openLocalProjectStore({ projectDir: resolve(process.env.LEAK_BASE!, g) });
  try {
    const p: any = s.loadSnapshot()!.project;
    for (const e of p.endings ?? []) {
      const own = e.presentation?.backgroundResourceId;
      const cands = endingBackdropCandidates(p, own);
      const before = cands[0] ?? null;
      const after = own ?? cands.find((id: string) => !art.has(id)) ?? null;
      rows.push({ game: g, ending: e.id, before, after, beforeIsDefault: before !== null && art.has(before) });
    }
  } finally { s.close(); }
}
console.log('ROWS ' + JSON.stringify({ factory: [...art], rows }));

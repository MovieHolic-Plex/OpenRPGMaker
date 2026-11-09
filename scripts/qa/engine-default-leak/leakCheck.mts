
import { resolve } from 'node:path'; import { readdirSync } from 'node:fs';
import { openLocalProjectStore } from '../../../electron/local-store/store';
import { runGameCheck } from '@/qa/gameCheck';
import { createBlankProject } from '@/project/defaults';
import { projectDefaultLeaks } from '@/project/defaultLeaks';
import { buildQaFixture } from '../../../test/fixtures/qaGame/qaGameFixtures';
const f = (p: any) => runGameCheck(p, { skipAutoPlay: true }).findings.filter((x) => x.code.startsWith('default-leak-')).map((x) => x.code);
const out: any = { blank: projectDefaultLeaks(createBlankProject() as any).map((l) => l.id), cleanFixture: f(buildQaFixture('clean')) };
const base = process.env.LEAK_BASE; const games: any = {};
if (base) for (const g of readdirSync(base).sort()) {
  const s = await openLocalProjectStore({ projectDir: resolve(base, g) });
  try { games[g] = f(s.loadSnapshot()!.project); } finally { s.close(); }
}
out.games = games;
console.log('RESULT ' + JSON.stringify(out));

// 판정자가 이미 아는 결함(지시 없는 인물)을 실제로 가려내는지 본다. 기존 후보 파일을 읽어 판정만 호출한다.
import { readFileSync, writeFileSync } from 'node:fs';
import { critiqueOpeningStills } from '../lib/openingStillCritic.ts';
const root = `${process.env.HOME}/claude-viz/opening-prompt-ab`;
const url = (f: string) => `data:image/png;base64,${readFileSync(`${root}/${f}`).toString('base64')}`;
const cases = [
  { name: 'shot1', context: { prompt: 'The northern lighthouse of a star-lantern archipelago has just gone dark; the lamp still smokes', focus: 'the dead lamp in the lantern room, thread of smoke', cast: 'nobody', angle: 'low angle from the gallery rail', light: 'cold moonlight from the upper left', palette: 'deep ink blue, bruised violet, one warm amber accent', artStyle: 'moody hand-painted illustration' },
    cands: [{ id: 'A', f: 'codex/1-wide-after.png' }, { id: 'B', f: 'codex-cast/1-wide-after.png' }, { id: 'C', f: '1-wide-after.png' }] },
  { name: 'shot2', context: { prompt: "In the keeper's cabin a small armoured pangolin guards a glowing ember jar while the keeper is missing", focus: 'the pangolin curled around the jar', cast: 'one small armoured pangolin on all fours, no humans', angle: 'over-the-shoulder from the doorway', light: 'the ember jar is the key light', palette: 'deep ink blue, bruised violet, one warm amber accent', artStyle: 'moody hand-painted illustration' },
    cands: [{ id: 'A', f: 'codex/2-medium-after.png' }, { id: 'B', f: 'codex-cast/2-medium-after.png' }, { id: 'C', f: '2-medium-after.png' }] },
];
const out: unknown[] = [];
for (const c of cases) { const r = await critiqueOpeningStills(c.cands.map(x => ({ id: x.id, dataUrl: url(x.f) })), c.context); out.push({ case: c.name, map: c.cands, ...r }); console.log(c.name, r.judge, r.verdict, 'winner', r.winnerId, r.scores.map(s => `${s.id}:${s.total}(cast ${s.cast})`).join(' ')); }
writeFileSync(`${process.env.HOME}/claude-viz/opening-critic-probe.json`, JSON.stringify(out, null, 1));

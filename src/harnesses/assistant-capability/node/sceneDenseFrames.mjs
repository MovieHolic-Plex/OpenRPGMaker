// 상호작용 직후 촘촘한 프레임 — 2초 간격 프레임은 「말하고 걸어가 사라짐」을 한 칸 사이에 삼킨다(r2 npc-walk-out).
//   node sceneDenseFrames.mjs <attempt dir>  → film/dense/i<N>_<NN>.png (도착한 대상마다 1초 전~8초 뒤, 0.5초 간격, 최대 3곳)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(process.argv[2]);
const film = resolve(dir, 'film');
const log = JSON.parse(readFileSync(resolve(film, 'film-log.json'), 'utf8'));
if (!existsSync(resolve(film, 'film.mp4'))) { console.log('no video'); process.exit(0); }
// The recording starts when the page context opens (after the local server is up) and stops at close: anchor on the end.
const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', resolve(film, 'film.mp4')]);
const duration = Number(String(probe.stdout).trim());
const end = log.find(e => e.kind === 'closing')?.t ?? (Math.max(...log.map(e => e.t)) + 1500);
const t0 = end - duration * 1000;
const out = resolve(film, 'dense');
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const hits = log.filter(e => e.kind === 'arrived' && e.arrived).slice(0, 3);
hits.forEach((hit, i) => {
  const at = Math.max(0, (hit.t - t0) / 1000 - 1);
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', at.toFixed(2), '-t', '9', '-i', resolve(film, 'film.mp4'), '-vf', 'fps=2', resolve(out, `i${i + 1}_%02d.png`)]);
  console.log(`interaction ${i + 1} ${hit.eventId} at ${at.toFixed(1)}s`, r.status === 0 ? 'ok' : String(r.stderr));
});

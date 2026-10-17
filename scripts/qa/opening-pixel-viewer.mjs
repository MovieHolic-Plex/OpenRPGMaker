// 오프닝 결과 뷰어 — 컨택트 시트·샷 표·mp4/webm 을 한 장의 자체완결 HTML 로 묶어 claude-viz 에 올린다.
// 사용: node scripts/qa/opening-pixel-viewer.mjs <outDir> <name> [--title "..."] [--iteration N]
// 규칙: 그림은 data URI 로, 동영상은 같은 디렉터리 파일로 복사해 상대 경로로 참조한다(외부 CDN·절대경로 금지).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i < 0 ? d : argv[i + 1]; };
const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--title' && argv[i - 1] !== '--iteration');
const [outDirRaw, nameRaw] = positional;
if (!outDirRaw || !nameRaw) throw Error('Usage: opening-pixel-viewer.mjs <outDir> <name> [--title "..."] [--iteration N]');
const outDir = path.resolve(outDirRaw);
const name = nameRaw.replace(/\.html$/u, '');
const viz = path.join(os.homedir(), 'claude-viz');
fs.mkdirSync(viz, { recursive: true });
const dataUri = (file) => (fs.existsSync(file) ? `data:image/png;base64,${fs.readFileSync(file).toString('base64')}` : null);
const copies = [];
const copyMedia = (file, label) => {
  if (!fs.existsSync(file)) return null;
  const target = `${name}-${label}`;
  fs.copyFileSync(file, path.join(viz, target));
  copies.push(target);
  return target;
};
const record = fs.existsSync(path.join(outDir, 'record.json')) ? JSON.parse(fs.readFileSync(path.join(outDir, 'record.json'), 'utf8')) : {};
const summary = fs.existsSync(path.join(outDir, 'SUMMARY.json')) ? JSON.parse(fs.readFileSync(path.join(outDir, 'SUMMARY.json'), 'utf8')) : null;
const contactSheet = dataUri(path.join(outDir, 'contact-sheet.png'));
const animatic = copyMedia(path.join(outDir, 'opening-animatic.mp4'), 'animatic.mp4');
const player = copyMedia(path.join(outDir, 'opening-player.webm'), 'player.webm');
const shotsRoot = path.join(outDir, 'player-shots');
const shotShots = fs.existsSync(shotsRoot) ? fs.readdirSync(shotsRoot).filter(f => f.endsWith('.png')).sort() : [];
const playerStill = shotShots.length ? dataUri(path.join(shotsRoot, shotShots[shotShots.length - 1])) : null;
const shotList = (record.shotList ?? []).map((s) => {
  const moves = (s.layers ?? []).filter(l => l.region || l.glow || l.shaft || l.walk || l.emote);
  return { id: s.id, seconds: ((s.durationMs ?? 0) / 1000).toFixed(1), moves: moves.map(l => `${l.id}(${l.region ?? (l.glow ? 'glow' : l.shaft ? 'shaft' : l.walk ? 'walk' : l.emote)})`).join(' '), caption: (s.caption ?? []).join(' / ') };
});
const esc = (v) => String(v ?? '').replace(/[&<>]/gu, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>${esc(flag('title', name))}</title>
<style>
 :root{color-scheme:dark}
 body{margin:0;background:#0b0d11;color:#e6e9ef;font:14px/1.5 system-ui,sans-serif}
 header{padding:20px 24px;border-bottom:1px solid #232833}
 h1{margin:0 0 6px;font-size:20px}
 .meta{color:#98a2b3;font-size:13px}
 main{padding:20px 24px;display:grid;gap:24px;max-width:1200px}
 section h2{font-size:15px;margin:0 0 10px;color:#9fd6c3;font-weight:600}
 video{width:100%;background:#000;border:1px solid #232833;border-radius:6px}
 img.sheet{width:100%;border:1px solid #232833;border-radius:6px;image-rendering:pixelated}
 table{width:100%;border-collapse:collapse;font-size:13px}
 th,td{border-bottom:1px solid #232833;padding:6px 8px;text-align:left;vertical-align:top}
 th{color:#98a2b3;font-weight:500}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
 .grid img{width:100%;border:1px solid #232833;border-radius:4px}
 .note{color:#98a2b3;font-size:12px}
</style></head><body>
<header><h1>${esc(flag('title', name))}</h1>
<div class="meta">${esc(flag('iteration', ''))}${flag('iteration', '') ? ' · ' : ''}${summary ? `${summary.stats.turns}턴 / 도구 ${summary.stats.toolCalls}회 / 오류 ${summary.stats.toolErrors}회` : ''}${record.openingMs ? ` · 오프닝 ${(record.openingMs / 1000).toFixed(1)}s / ${record.shots ?? ''}샷` : ''}</div></header>
<main>
 <section><h2>공용 렌더러 컨택트 시트 (샷별 표본 · 초록 줄 = 실제로 움직이는 레이어)</h2>
 ${contactSheet ? `<img class="sheet" src="${contactSheet}" alt="contact sheet">` : '<p class="note">contact-sheet.png 없음</p>'}</section>
 <section><h2>애니메틱 전체 재생 (공용 렌더러 프레임 → mp4, 무음)</h2>
 ${animatic ? `<video controls src="${animatic}"></video>` : '<p class="note">opening-animatic.mp4 없음</p>'}</section>
 <section><h2>실제 출하 플레이어 재생 (player.html · 타이틀→오프닝→시작 맵 handoff, 무음)</h2>
 ${player ? `<video controls src="${player}"></video>` : '<p class="note">opening-player.webm 없음</p>'}</section>
 <section><h2>플레이어 단계 스크린샷</h2><div class="grid">
 ${shotShots.map(f => `<figure style="margin:0"><img src="${dataUri(path.join(shotsRoot, f))}" alt="${esc(f)}"><figcaption class="note">${esc(f)}</figcaption></figure>`).join('')}
 </div></section>
 <section><h2>샷 표</h2><table><thead><tr><th>샷</th><th>길이</th><th>움직이는 것</th><th>자막</th></tr></thead><tbody>
 ${shotList.map(s => `<tr><td>${esc(s.id)}</td><td>${esc(s.seconds)}s</td><td>${esc(s.moves) || '<span class="note">없음</span>'}</td><td>${esc(s.caption)}</td></tr>`).join('')}
 </tbody></table></section>
 <section><h2>기록</h2><pre class="note" style="white-space:pre-wrap">${esc(JSON.stringify({ handoff: record.handoff ?? null, resourceFailures: record.resourceFailures ?? [], rendererErrors: record.rendererErrors ?? [], pageErrors: record.pageErrors ?? [], issues: summary?.issues ?? [], stoppedEarly: summary?.stoppedEarly ?? null }, null, 1))}</pre></section>
</main></body></html>`;
fs.writeFileSync(path.join(viz, `${name}.html`), html);
console.log(JSON.stringify({ html: path.join(viz, `${name}.html`), media: copies, url: `http://mdc-server:18301/${name}.html` }, null, 1));

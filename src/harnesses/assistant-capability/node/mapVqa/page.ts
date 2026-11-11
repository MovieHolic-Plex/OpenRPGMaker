// map-vqa 결과 한 장(자체완결 HTML, 그림은 data URI). 맨 위에 집계 표, 그 아래 맵마다 1배 그림 위에 결함 영역을 번호로 표시한다.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Reviewer, Tally } from './verdict';

const esc = (text: unknown): string => String(text ?? '').replace(/[&<>"]/gu, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
const SEVERITY_KO: Record<string, string> = { blocker: '막힘', major: '큰 결함', polish: '다듬기' };
const groupTitle = (group: string): string => group.startsWith('A:') ? `게임 통판 ${group.slice(2)}` : group.startsWith('B:') ? `맵 깔기 요청 ${group.slice(2)}` : group.startsWith('good:') ? `견본 ${group.slice(5)}` : group;
const pct = (value: number): string => `${Math.round(value * 100)}%`;

export function writeMapVqaPage(input: { out: string; tally: Tally; reviewer: Reviewer; before: any | null; html?: string }): string {
  const { tally, reviewer, before } = input, t = tally.totals;
  const calibration: any = (tally as any).calibration ?? { status: 'uncalibrated' };
  const calibrationLine = calibration.status === 'uncalibrated'
    ? '<p class="warn"><b>보정 전 숫자입니다.</b> 이 검수자가 심어 둔 결함을 얼마나 잡는지 아직 재지 않았습니다.</p>'
    : `<p class="${calibration.status === 'calibrated' ? 'ok' : 'warn'}"><b>검수자 보정(${esc(reviewer.version)})</b>: 일부러 심은 결함 ${calibration.planted?.total ?? '-'}개 중 놓친 것 ${calibration.planted?.missed ?? '-'}개(놓침 ${pct(calibration.missRate ?? 0)}) · 사람이 만든 좋은 맵 ${calibration.good?.total ?? '-'}장 중 «막힘»을 잘못 붙인 것 ${calibration.good?.withBlocker ?? '-'}장(헛경보 ${pct(calibration.falseAlarmRate ?? 0)})${calibration.status === 'calibrated' ? '' : ' — <b>놓친 것이 있어 아직 보정되지 않은 판입니다.</b>'}. 다만 그 좋은 맵 ${calibration.good?.total ?? '-'}장 중 ${calibration.good?.withMajor ?? '-'}장에도 «큰 결함»은 붙었습니다(견본의 지붕·물이 걸어지는 것 등) — «큰 결함» 수는 넉넉하게 잡힌 숫자로 읽어 주세요.</p>`;
  const beforeClass = (id: string) => before?.byClass?.[id];
  const delta = (was: number | undefined) => was === undefined ? '' : ` <span class="was">(앞 ${was})</span>`;
  const rankedRows = tally.ranked.map((row, index) => `<tr><td>${index + 1}</td><td><b>${esc(row.label)}</b><div class="id">${esc(row.class)}</div></td><td class="n"><b>${(row as any).score ?? row.blocker * 3 + row.major}</b></td><td class="n blocker">${row.blocker}${delta(beforeClass(row.class)?.blocker)}</td><td class="n major">${row.major}${delta(beforeClass(row.class)?.major)}</td><td class="n">${row.polish}${delta(beforeClass(row.class)?.polish)}</td><td class="n">${row.maps}${delta(beforeClass(row.class)?.maps)}</td></tr>`).join('');
  const groupRows = Object.entries<any>(tally.perGroup).map(([group, n]) => `<tr><td>${esc(groupTitle(group))}</td><td class="n">${n.maps}</td><td class="n blocker">${n.withBlocker}</td><td class="n major">${n.withMajorOrWorse}</td><td class="n">${n.clean}</td><td class="n">${n.blocker} / ${n.major} / ${n.polish}</td></tr>`).join('');
  const corpusTitle: Record<string, string> = { A: '게임 통판에서 조수가 깐 맵', B: '맵 깔기 15가지(한 문장 요청)', good: '사람이 만든 견본' };
  const corpusRows = Object.entries<any>((tally as any).perCorpus ?? {}).map(([corpus, n]) => `<tr><td>${esc(corpusTitle[corpus] ?? corpus)}</td><td class="n">${n.maps}</td><td class="n blocker">${n.withBlocker}${delta(before?.perCorpus?.[corpus]?.withBlocker)}</td><td class="n major">${n.withMajorOrWorse}${delta(before?.perCorpus?.[corpus]?.withMajorOrWorse)}</td><td class="n">${n.clean}${delta(before?.perCorpus?.[corpus]?.clean)}</td><td class="n">${n.blocker} / ${n.major} / ${n.polish}</td></tr>`).join('');
  const layJobs: any[] = (tally as any).layJobs ?? [];
  const LAY_STATUS: Record<string, string> = { laid: '깔았음', nothing: '아무것도 안 깔림', timeout: '시간 초과', infra: '기반 오류' };
  const layTable = layJobs.length ? `<h2>맵 깔기 15가지 — 요청마다</h2><p>빈 프로젝트에서 한 문장으로 시킨 결과입니다. «끝냄»은 조수가 스스로 완료라고 한 것이고, 오른쪽 숫자가 검수자가 그 요청의 맵에서 찾은 결함입니다.</p><table><tr><th>요청</th><th>결과</th><th>맵(깐 것/바란 것)</th><th>조수 «끝냄»</th><th>도구 호출(거절)</th><th>분</th><th>막힘 / 큰 결함 / 다듬기</th></tr>${layJobs.map(job => { const n = (tally.perGroup as any)[`B:${job.id}`]; return `<tr><td><b>${esc(job.id)}</b><div class="id">${esc(job.request)}</div></td><td class="${job.status === 'laid' ? '' : 'warn'}">${esc(LAY_STATUS[job.status] ?? job.status)}</td><td class="n">${job.maps} / ${job.wantedMaps}</td><td>${job.complete === true ? '예' : job.complete === false ? '아니오' : '-'}</td><td class="n">${job.toolCalls} (${job.toolErrors})</td><td class="n">${job.minutes}</td><td class="n">${n ? `<span class="blocker">${n.blocker}</span> / <span class="major">${n.major}</span> / ${n.polish}` : '-'}</td></tr>`; }).join('')}</table>` : '';
  const beforeLine = before ? `<p>앞 실행과 비교: 막힘이 있는 맵 ${before.totals.withBlocker}/${before.totals.maps} → <b>${t.withBlocker}/${t.maps}</b> · 큰 결함 이상이 있는 맵 ${before.totals.withMajorOrWorse} → <b>${t.withMajorOrWorse}</b> · 결함 수 막힘 ${before.totals.blocker} → <b>${t.blocker}</b>, 큰 결함 ${before.totals.major} → <b>${t.major}</b></p>` : '';
  const sections: string[] = [];
  let lastGroup = '';
  for (const map of tally.maps) {
    if (map.group !== lastGroup) { sections.push(`<h2>${esc(groupTitle(map.group))}</h2>`); lastGroup = map.group; }
    const file = resolve(input.out, 'maps', map.id, 'marked.png');
    const image = existsSync(file) ? `<img src="data:image/png;base64,${readFileSync(file).toString('base64')}" alt="${esc(map.label)}">` : '<p class="warn">그림 없음</p>';
    const defects = map.status !== 'reviewed' ? '<p class="warn">미검증 — 검수자가 답하지 못했습니다. 합격으로 세지 않습니다.</p>'
      : map.defects.length ? `<ol>${map.defects.map(defect => `<li><span class="badge ${defect.severity}">${SEVERITY_KO[defect.severity]}</span> <b>${esc(reviewer.classes[defect.class] ?? defect.class)}</b> <span class="cell">(${defect.region.x},${defect.region.y}) ${defect.region.w}×${defect.region.h}칸</span><div>${esc(defect.evidence)}</div></li>`).join('')}</ol>` : '<p class="ok">검수자가 결함을 찾지 못했습니다.</p>';
    sections.push(`<section class="map"><h3>${esc(map.label)} <span class="id">${esc(map.size)} · ${esc(map.tilesetId)}</span> ${map.blocker ? `<span class="badge blocker">막힘 ${map.blocker}</span>` : ''} ${map.major ? `<span class="badge major">큰 결함 ${map.major}</span>` : ''} ${map.polish ? `<span class="badge polish">다듬기 ${map.polish}</span>` : ''}</h3><div class="pic">${image}</div>${defects}</section>`);
  }
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>조수가 깐 맵 — 그림 검수</title><style>
body{font:15px/1.55 system-ui,"Noto Sans KR",sans-serif;margin:0 auto;max-width:1180px;padding:20px;background:#15161a;color:#e8e8ea}
h1{font-size:24px;margin:0 0 6px}h2{font-size:19px;margin:34px 0 8px;border-bottom:1px solid #3a3c44;padding-bottom:4px}h3{font-size:15px;margin:0 0 6px}
p{margin:6px 0}table{border-collapse:collapse;margin:10px 0 18px;width:100%}th,td{border:1px solid #33353d;padding:5px 8px;text-align:left;vertical-align:top}th{background:#22242b}
td.n{text-align:right;white-space:nowrap}td.blocker,span.blocker{color:#ff7b7b;font-weight:700}td.major,span.major{color:#ffb454;font-weight:700}.id{color:#8d8f99;font-size:12px;font-weight:400}.was{color:#8d8f99;font-weight:400}
.badge{display:inline-block;border-radius:4px;padding:0 6px;font-size:12px;font-weight:700;color:#111}.badge.blocker{background:#ff5c5c}.badge.major{background:#ff9d2e}.badge.polish{background:#ffe85c}
.map{margin:16px 0 26px;padding:12px;background:#1c1d23;border:1px solid #2c2e36;border-radius:8px}.pic{overflow:auto;background:#0d0d10;padding:6px;border-radius:4px}.pic img{image-rendering:pixelated;display:block}
ol{margin:8px 0 0 0;padding-left:26px}li{margin:5px 0}.cell{color:#8d8f99;font-size:12px}.warn{color:#ffb454}.ok{color:#7fd68a}
</style></head><body>
<h1>조수가 깐 맵 — 그림 검수</h1>
<p>검수자(Claude Opus 5.5)가 맵마다 그림을 보고 «플레이어가 엉성하게 깔린 맵이라고 할 까닭»을 찾았습니다. 그림 위 상자가 결함이 있는 자리입니다: <span class="badge blocker">막힘</span> 들어가거나 지나갈 수 없음 · <span class="badge major">큰 결함</span> 보자마자 어색함 · <span class="badge polish">다듬기</span> 찾아봐야 보임. 상자 번호는 아래 목록의 번호입니다.</p>
${calibrationLine}
<p><b>맵 ${t.maps}장</b>(검수 ${t.reviewed}) · 막힘이 있는 맵 <b>${t.withBlocker}</b> · 큰 결함 이상이 있는 맵 <b>${t.withMajorOrWorse}</b> · 큰 결함이 없는 맵 <b>${t.clean}</b> · 결함 수: 막힘 ${t.blocker} / 큰 결함 ${t.major} / 다듬기 ${t.polish}</p>
${beforeLine}
<h2>결함 종류 순위</h2>
<p>점수 = 막힘 × 3 + 큰 결함. 점수가 높은 종류부터 빌더·도구를 고칩니다.</p>
<table><tr><th>#</th><th>종류</th><th>점수</th><th>막힘</th><th>큰 결함</th><th>다듬기</th><th>걸린 맵</th></tr>${rankedRows}</table>
<h2>묶음별</h2>
<table><tr><th>말뭉치</th><th>맵</th><th>막힘이 있는 맵</th><th>큰 결함 이상</th><th>큰 결함 없음</th><th>결함 수(막힘/큰/다듬기)</th></tr>${corpusRows}</table>
<table><tr><th>묶음</th><th>맵</th><th>막힘이 있는 맵</th><th>큰 결함 이상</th><th>큰 결함 없음</th><th>결함 수(막힘/큰/다듬기)</th></tr>${groupRows}</table>
${layTable}
${sections.join('\n')}
</body></html>`;
  const target = resolve(input.html ?? resolve(input.out, 'page.html'));
  writeFileSync(target, html);
  if (input.html) writeFileSync(resolve(input.out, 'page.html'), html);
  return target;
}

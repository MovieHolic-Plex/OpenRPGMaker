// 명세 은행 — 보고 쪽(자체 완결 HTML): 은행에 든 것 · 신뢰 수치(그때 커밋으로 재생한 결과) · 이력 증명(전/후 표와 1배 맵 짝) · 한 번 도는 시간.
//   bun scripts/qa/assistant-v2/specBank/page.mts --out <page.html> --before <결과A> --after <결과B> [--trust <결과>…] [--pairs "게임:맵 이름,…"] [--note <글>]
// 그림은 data URI 로 넣는다(바깥 주소·절대 경로 없음). 수치는 그림을 보지 않은 것이라고 쪽에 적는다.
import fs from "node:fs";
import path from "node:path";
import { diffReport, METRICS, show, sumMetrics, type GameMetrics } from "./metrics.mts";
import type { Spec } from "./spec.mts";

const argv = process.argv.slice(2);
const one = (name: string): string | undefined => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : undefined; };
const many = (name: string): string[] => argv.flatMap((a, i) => (a === name && argv[i + 1] ? [argv[i + 1]!] : []));
const ROOT = path.resolve(import.meta.dir, "../../../..");
const bankDir = one("--bank") ?? path.join(ROOT, "harness-data/assistant-capability/spec-bank");
const out = one("--out"), before = one("--before"), after = one("--after");
if (!out || !before || !after) { console.error("page --out <html> --before <결과A> --after <결과B> [--trust <결과>…] [--pairs 게임:맵,…] [--note 글]"); process.exit(2); }

const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"]/gu, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
const readJson = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;
const metricsOf = (dir: string): GameMetrics[] => fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, "metrics.json"))).sort().map((d) => readJson<GameMetrics>(path.join(dir, d, "metrics.json")));
type Replay = { id: string; kind?: string; replayedAt: string; layout: string; ms: number; source: Spec["source"]; calls: { total: number; played: number; sameOutcome: number; writes: number; writesSame: number; okToFail: string[]; failToOk: string[]; unresolvedIds: string[]; needsOutside: string[]; renamed?: string[]; resent?: string[] }; salts: { recorded: number; kept: number }; turns: { forced: number; verdictWas?: { complete: boolean }; verdictNow?: { complete: boolean }; error?: string }[]; trust?: { maps: { saved: number; named: number; sameSize: number; sameTiles: number }; events: { saved: number; matched: number; samePlace: number; sameContent: number } }; counters: { blockedFetch: number } };
const replaysOf = (dir: string): Replay[] => fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, "replay.json"))).sort().map((d) => readJson<Replay>(path.join(dir, d, "replay.json")));
type Bank = { head?: string; at?: string; jobs?: number; replaySec?: number; wallSec?: number; games?: string[] };
const bankOf = (dir: string): Bank => fs.existsSync(path.join(dir, "bank.json")) ? readJson<Bank>(path.join(dir, "bank.json")) : {};
const table = (head: string[], rows: (string | number)[][], cls = ""): string => `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${typeof c === "string" && c.startsWith("<") ? c : esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

// ── 1. 은행에 든 것 ──────────────────────────────────────────────────────────────────────────────────────────
const specs = fs.readdirSync(bankDir).filter((f) => f.endsWith(".json")).sort().map((f) => readJson<Spec>(path.join(bankDir, f)));
const games = specs.filter((s) => s.kind === "game"), places = specs.filter((s) => s.kind === "place");
const calls = (s: Spec) => s.turns.reduce((n, t) => n + t.calls.length, 0);
const gameRows = games.map((s) => [s.id, s.reference.final?.blueprint?.genre ?? "-", s.reference.final?.blueprint?.setting ?? "(세계 없음)", s.reference.final?.maps.length ?? "-", s.source.head, s.turns.length, calls(s), Object.keys(s.salts).length, s.request]);
const placeKinds = new Map<string, { n: number; tilesets: Set<string>; calls: number }>();
for (const s of places) { const kind = s.id.replace(/^lay-(main|base)-/u, ""); const row = placeKinds.get(kind) ?? { n: 0, tilesets: new Set<string>(), calls: 0 }; row.n += 1; row.calls += calls(s); for (const m of s.reference.final?.maps ?? []) row.tilesets.add(m.tileset); placeKinds.set(kind, row); }

// ── 2. 신뢰 수치 ─────────────────────────────────────────────────────────────────────────────────────────────
const trust = many("--trust").flatMap((dir) => replaysOf(dir));
const trustRows = trust.map((r) => [r.id, r.replayedAt, `${r.calls.played}/${r.calls.total}`, `${r.calls.sameOutcome}/${r.calls.played}`, `${r.calls.writesSame}/${r.calls.writes}`, `${r.salts.kept}/${r.salts.recorded}`,
  r.trust ? `${r.trust.maps.sameTiles}/${r.trust.maps.saved}` : "-", r.trust ? `${r.trust.events.samePlace}/${r.trust.events.saved}` : "-", r.trust ? `${r.trust.events.sameContent}/${r.trust.events.saved}` : "-",
  r.turns.some((t) => t.verdictWas) ? `${r.turns.filter((t) => t.verdictWas && t.verdictNow && t.verdictWas.complete === t.verdictNow.complete).length}/${r.turns.filter((t) => t.verdictWas).length}` : "(기록 없음)"]);
const trustGame = trust.filter((r) => r.kind !== "place"), trustPlace = trust.filter((r) => r.kind === "place");
// 장소 소금이 저장본에 남은 판(장소 설계 기억 뒤의 판)만 «같은 게임을 되살린다»를 물을 수 있다. 옛 판은 장소 이름에서 정한 소금으로 짓는다.
const salted = trustGame.filter((r) => r.salts.recorded > 0), unsalted = trustGame.filter((r) => r.salts.recorded === 0);
const isPlaceRow = (row: (string | number)[]): boolean => String(row[0]).startsWith("lay-");
const ratio = (list: Replay[], num: (r: Replay) => number, den: (r: Replay) => number): string => `${list.reduce((n, r) => n + num(r), 0)}/${list.reduce((n, r) => n + den(r), 0)}`;

// ── 3. 이력 증명 ─────────────────────────────────────────────────────────────────────────────────────────────
const A = metricsOf(before), B = metricsOf(after), bankA = bankOf(before), bankB = bankOf(after);
const nameA = `전 ${bankA.at ?? bankA.head ?? ""}`, nameB = `후 ${bankB.at ?? bankB.head ?? ""}`;
const report = diffReport(A, B, nameA, nameB);
const HEADLINE = ["exitsOnRoad", "exitsFullWidth", "arriveRoad", "arriveInside", "arriveFacing"];
const rowHtml = (r: (typeof report.rows)[number]): (string | number)[] => [r.label, r.a, r.b, r.dir > 0 ? '<span class="up">▲ 좋아짐</span>' : r.dir < 0 ? '<span class="down">▼ 나빠짐</span>' : "", r.betterGames.length, r.worseGames.join(" ")];
const picture = (dir: string, game: string, mapName: string): string | undefined => {
  const folder = path.join(dir, game, "maps");
  if (!fs.existsSync(folder)) return undefined;
  const key = mapName.replace(/[^\p{L}\p{N}]+/gu, "_");
  const file = fs.readdirSync(folder).find((f) => f.replace(/^\d+-/u, "").replace(/\.png$/u, "") === key);
  return file ? `data:image/png;base64,${fs.readFileSync(path.join(folder, file)).toString("base64")}` : undefined;
};
const pairs = (one("--pairs") ?? "").split(",").map((p) => p.trim()).filter(Boolean).map((p) => { const [game, map] = p.split(":"); return { game: game!, map: map!, a: picture(before, game!, map!), b: picture(after, game!, map!) }; }).filter((p) => p.a && p.b);
const exitLines = (dir: string, game: string, map: string): string[] => { const f = path.join(dir, game, "metrics.json"); return fs.existsSync(f) ? (readJson<GameMetrics>(f).lines.exits ?? []).filter((l) => l.startsWith(`${map} `)).map((l) => l.slice(map.length + 1)) : []; };

// 판마다: 머리 칸의 전→후와 «그때와 같은 결과의 쓰기»(명세의 나이).
const cell = (list: GameMetrics[], id: string, key: string): string => show(list.find((g) => g.id === id)?.values[key]);
const perGame = A.filter((g) => g.kind !== "place" && B.some((x) => x.id === g.id)).map((g) => [g.id, `${cell(A, g.id, "replayWritesSame")} → ${cell(B, g.id, "replayWritesSame")}`, ...HEADLINE.slice(0, 4).map((key) => `${cell(A, g.id, key)} → ${cell(B, g.id, key)}`)]);
const placeA = sumMetrics(A.filter((g) => g.kind === "place")), placeB = sumMetrics(B.filter((g) => g.kind === "place"));
perGame.push([`장소 하나 ${A.filter((g) => g.kind === "place").length}판 합계`, `${show(placeA.replayWritesSame)} → ${show(placeB.replayWritesSame)}`, ...HEADLINE.slice(0, 4).map((key) => `${show(placeA[key])} → ${show(placeB[key])}`)]);

// ── 4. 시간 · 5. 못 되살리는 것 ──────────────────────────────────────────────────────────────────────────────
const afterReplays = replaysOf(after);
const outside = new Map<string, number>();
for (const r of afterReplays) for (const line of r.calls.needsOutside) { const name = line.split(" ")[1] ?? "?"; outside.set(name, (outside.get(name) ?? 0) + 1); }
const sumAfter = (pick: (r: Replay) => number): number => afterReplays.reduce((n, r) => n + pick(r), 0);
const total = sumMetrics(B);

const css = `body{font:15px/1.6 system-ui,-apple-system,"Noto Sans KR",sans-serif;margin:0;background:#f6f5f1;color:#1c1b19}main{max-width:1180px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:26px;margin:0 0 6px}h2{font-size:19px;margin:38px 0 10px;padding-top:14px;border-top:2px solid #1c1b19}h3{font-size:15px;margin:22px 0 6px}
p{margin:6px 0}.lead{color:#55524b}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.card{background:#fff;border:1px solid #d9d6cc;border-radius:8px;padding:12px 14px}
.card b{display:block;font-size:22px;line-height:1.25}.card span{color:#55524b;font-size:13px}
table{border-collapse:collapse;width:100%;background:#fff;font-size:13px;margin:8px 0}th,td{border:1px solid #d9d6cc;padding:4px 8px;text-align:left;vertical-align:top}th{background:#ebe8de;font-weight:600}
td:nth-child(n+2){font-variant-numeric:tabular-nums}.up{color:#0b6b3a;font-weight:600}.down{color:#b3261e;font-weight:600}.note{background:#fff8dc;border:1px solid #e3d48a;border-radius:6px;padding:8px 12px;margin:10px 0;font-size:13.5px}
code{background:#ebe8de;padding:1px 5px;border-radius:4px;font-size:13px}pre{background:#1c1b19;color:#f3f1ea;padding:12px 14px;border-radius:8px;overflow:auto;font-size:13px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0 22px}.pair figure{margin:0;background:#fff;border:1px solid #d9d6cc;border-radius:8px;padding:8px}.pair img{max-width:100%;image-rendering:pixelated;display:block;margin:0 auto}
figcaption{font-size:12.5px;color:#55524b;margin-top:6px}details{margin:8px 0}summary{cursor:pointer;color:#35332d}@media(max-width:800px){.cards{grid-template-columns:1fr 1fr}.pair{grid-template-columns:1fr}}`;

const headline = report.rows.filter((r) => HEADLINE.includes(r.key));
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>조수 v2 명세 은행</title><style>${css}</style></head><body><main>
<h1>조수 v2 명세 은행 — 모델 없이 빌더만 다시 돌린다</h1>
<p class="lead">저장된 Terra 판에서 «모델이 보낸 도구 호출»만 남겨 두고, 빌더를 고칠 때마다 그 명세 전부를 지금 코드로 다시 지어 수치와 1배 그림을 전/후로 견준다. 모델 호출 0번.</p>
<div class="cards">
<div class="card"><b>${specs.length}판</b><span>게임 하나 ${games.length} · 장소 하나 ${places.length} · 호출 ${specs.reduce((n, s) => n + calls(s), 0)}개 · ${(fs.readdirSync(bankDir).reduce((n, f) => n + fs.statSync(path.join(bankDir, f)).size, 0) / 1e6).toFixed(1)}MB</span></div>
<div class="card"><b>맵 ${ratio(salted, (r) => r.trust?.maps.sameTiles ?? 0, (r) => r.trust?.maps.saved ?? 0)}</b><span>신뢰 수치 — 소금이 기록된 게임 판 ${salted.length}개를 지은 커밋으로 재생했을 때 저장본과 타일까지 같은 맵 · 같은 칸의 이벤트 ${ratio(salted, (r) => r.trust?.events.samePlace ?? 0, (r) => r.trust?.events.saved ?? 0)}</span></div>
<div class="card"><b>${esc(headline.find((r) => r.key === "exitsOnRoad")?.a ?? "-")} → ${esc(headline.find((r) => r.key === "exitsOnRoad")?.b ?? "-")}</b><span>출구가 길 위 — PR #4609 앞 커밋 → 지금 main, 같은 명세</span></div>
<div class="card"><b>${bankB.wallSec ? `${Math.floor(bankB.wallSec / 60)}분 ${bankB.wallSec % 60}초` : "-"}</b><span>은행 전체 한 번(재생 ${bankB.replaySec ?? "?"}초 + 재기) · 동시에 ${bankB.jobs ?? "?"}개</span></div>
</div>
${one("--note") ? `<div class="note">${esc(one("--note"))}</div>` : ""}
<div class="note">이 쪽의 수치는 기계가 센 것이다(<b>화면 미검증</b>). 그림을 직접 본 것은 «3. 이력으로 증명»의 맵 짝뿐이다. 모든 맵의 1배 그림은 결과 폴더의 <code>&lt;게임&gt;/maps/</code> 에 있다 — 적대적 검수자에게 그 폴더를 주면 된다.</div>

<h2>1. 은행에 든 것</h2>
<h3>게임 하나를 지은 판 ${games.length}</h3>
${table(["판", "장르(청사진)", "세계(칩셋 한 벌)", "맵", "지은 커밋", "턴", "호출", "소금", "요청"], gameRows)}
<h3>장소 하나를 깐 판 ${places.length} (맵 깔기 24가지 · 두 묶음)</h3>
${table(["과제", "판 수", "호출", "칩셋"], [...placeKinds].map(([kind, row]) => [kind, row.n, row.calls, [...row.tilesets].join(", ")]))}
<p>명세 파일 하나 = 사용자 글 · 실행기에 간 글 · 호출 이름과 인자(차례 그대로) · 그때의 성공 여부와 결과 요약 160자 · 모델이 멈춘 자리 · 장소 소금 · 그때 id 의 이름표 · 저장본 요약. 모델의 글·결과 본문·그림·지시문은 없다.</p>

<h2>2. 얼마나 믿을 수 있나 — 그때 그 커밋으로 재생하면 저장본이 되살아나는가</h2>
<p>판마다 «그 판을 지은 커밋»의 작업 폴더를 /tmp 에 만들어 재생하고 저장본과 견줬다. 맵은 이름으로 짝지어 층 타일 지문을, 이벤트는 같은 맵의 갈래·이름·칸과 내용 지문(id 를 가린 것)을 본다.</p>
${trust.length ? `<div class="cards">
<div class="card"><b>맵 ${ratio(salted, (r) => r.trust?.maps.sameTiles ?? 0, (r) => r.trust?.maps.saved ?? 0)}</b><span>소금이 기록된 게임 판 ${salted.length}: 타일까지 같은 맵 · 쓰기 호출 ${ratio(salted, (r) => r.calls.writesSame, (r) => r.calls.writes)} 가 그때와 같은 결과</span></div>
<div class="card"><b>이벤트 ${ratio(salted, (r) => r.trust?.events.samePlace ?? 0, (r) => r.trust?.events.saved ?? 0)}</b><span>같은 판: 같은 칸의 이벤트(내용까지 같음 ${ratio(salted, (r) => r.trust?.events.sameContent ?? 0, (r) => r.trust?.events.saved ?? 0)})</span></div>
<div class="card"><b>맵 ${ratio(unsalted, (r) => r.trust?.maps.sameTiles ?? 0, (r) => r.trust?.maps.saved ?? 0)}</b><span>소금 기록이 없는 옛 게임 판 ${unsalted.length}: 배치가 다르다(장소 이름에서 정한 소금) · 같은 칸의 이벤트 ${ratio(unsalted, (r) => r.trust?.events.samePlace ?? 0, (r) => r.trust?.events.saved ?? 0)}</span></div>
<div class="card"><b>맵 ${ratio(trustPlace, (r) => r.trust?.maps.sameTiles ?? 0, (r) => r.trust?.maps.saved ?? 0)}</b><span>장소 판 ${trustPlace.length}: 칸 배치 실내·구성기 세계는 같고 코드 지형 마을·동굴·던전은 다르다</span></div></div>
${table(["판", "재생 커밋", "재생한 호출", "같은 결과", "쓰기 같은 결과", "소금", "타일 같은 맵", "같은 칸 이벤트", "내용 같은 이벤트", "완료 판정 일치(턴)"], trustRows.filter((row) => !isPlaceRow(row)))}
<details><summary>장소 판 ${trustPlace.length}개</summary>${table(["판", "재생 커밋", "재생한 호출", "같은 결과", "쓰기 같은 결과", "소금", "타일 같은 맵", "같은 칸 이벤트", "내용 같은 이벤트", "완료 판정 일치(턴)"], trustRows.filter(isPlaceRow))}</details>
<p>다른 맵 둘(jrpg-x1)은 작은 실내다 — 그때는 모델 쪽 방 설계 호출이 크기를 정했다. 같은 명세를 같은 커밋으로 두 번 재생하면 지표 336칸이 전부 같다(장소 8판 두 번 — 프로젝트는 시각 칸만 다르다).</p>` : "<p>(신뢰 재생 결과 폴더를 주지 않았다)</p>"}

<h2>3. 이력으로 증명 — PR #4609(출구는 길 끝에 선다) 앞 커밋 → 지금 main</h2>
<p>같은 은행을 <code>${esc(bankA.at ?? bankA.head ?? "")}</code>(#4609 바로 앞)의 빌더와 <code>${esc(bankB.at ?? bankB.head ?? "")}</code>(지금)의 빌더로 재생하고 같은 자(지금 폴더의 탐침)로 쟀다. 그 PR 이 모델 없는 표본(세계 열 + 주제 넷)에서 낸 수치는 길 위 17/79 → 81/81 · 길 폭 전체 0/73 → 68/73 · 도착 안쪽 19 → 84/86 이었다 — Terra 판의 «후»는 그때 재지 못했다.</p>
${table(["칸", nameA, nameB, "합계", "좋아진 판", "나빠진 판"], headline.map(rowHtml))}
<h3>판마다</h3>
${table(["판", "그때와 같은 결과의 쓰기(전 → 후)", "출구가 길 위", "가장자리 출구가 길 폭 전체", "도착 칸이 길 위", "도착 칸이 안쪽"], perGame)}
<p>«그때와 같은 결과의 쓰기»가 낮은 판은 명세가 그 빌더와 멀어진 것이다(옛 판 — 청사진 규칙·도구가 바뀌었다). 그런 판의 수는 «그 명세로 지금 빌더가 지은 다른 게임»의 수다.</p>
<h3>대조가 «나빠짐»으로 짚은 판</h3>
${report.rows.some((r) => r.worseGames.length) ? table(["칸", "나빠진 판(전→후)"], report.rows.filter((r) => r.worseGames.length).map((r) => [r.label, r.worseGames.join(" · ")])) : "<p>없음</p>"}
<p>은행이 하는 일이 이것이다 — 칸마다 나빠진 판을 이름으로 짚는다. 화면 미검증이고, 맞는지는 그 판의 그림과 탐침 줄(<code>&lt;결과&gt;/&lt;판&gt;/metrics.json</code> 의 <code>lines</code>)로 본다. ${esc(one("--worse-note") ?? "")}</p>
<details><summary>모든 칸(${report.rows.length})</summary>${table(["칸", nameA, nameB, "합계", "좋아진 판", "나빠진 판"], report.rows.map(rowHtml))}</details>
${pairs.map((p) => `<h3>${esc(p.game)} · ${esc(p.map)}</h3><div class="pair"><figure><img src="${p.a}" alt="전"><figcaption>${esc(nameA)} — ${esc(exitLines(before, p.game, p.map).join(" | ") || "바깥 맵 출구 없음")}</figcaption></figure><figure><img src="${p.b}" alt="후"><figcaption>${esc(nameB)} — ${esc(exitLines(after, p.game, p.map).join(" | ") || "바깥 맵 출구 없음")}</figcaption></figure></div>`).join("")}
<p>그림의 파란 칸은 맵 사이 이동 이벤트, 자주 칸은 그 밖의 투명 이벤트(잠김 한 줄 등)다.</p>

<h2>4. 한 줄 명령과 시간</h2>
<pre>bun scripts/qa/assistant-v2/specBank.mts ab --out /tmp/bank      # 기준(origin/main)의 빌더 → /tmp/bank/a · 지금 작업 폴더의 빌더 → /tmp/bank/b · 대조 표
# 나눠서: run --at origin/main --out A · run --out B · --diff A B   (몇 판만: --only fun-x1,lay-main-village)</pre>
<p>한 줄은 전·후 두 번을 같이 띄운다. 아래는 이력 증명에 쓴 두 번이고 바로 그 모양으로 돌렸다(같은 때에, 한 번에 6개씩) — 그래서 한 줄의 시간도 이쯤이다. 다른 작업자들이 같은 기계를 쓰던 때의 값이다(부하 평균 50~110).</p>
${table(["실행", "빌더", "판", "동시에", "재생", "전체"], [["전", bankA.at ?? bankA.head ?? "", A.length, bankA.jobs ?? "", `${bankA.replaySec ?? "?"}초`, `${bankA.wallSec ?? "?"}초`], ["후", bankB.at ?? bankB.head ?? "", B.length, bankB.jobs ?? "", `${bankB.replaySec ?? "?"}초`, `${bankB.wallSec ?? "?"}초`]])}
<p>가장 긴 판: ${afterReplays.slice().sort((x, y) => y.ms - x.ms).slice(0, 3).map((r) => `${esc(r.id)} ${Math.round(r.ms / 1000)}초`).join(" · ")}. 장소 판은 하나에 ${Math.round(afterReplays.filter((r) => r.kind === "place").reduce((n, r) => n + r.ms, 0) / Math.max(1, afterReplays.filter((r) => r.kind === "place").length) / 1000)}초쯤이다.</p>

<h2>5. 그대로 못 되살리는 것</h2>
<ul>
<li><b>모델 쪽 판정자</b>(독립 검토자·화면 검수·장소 비평가)는 돌지 않는다. 그 판정자가 다시 연 자리에서는 남은 대본을 이어 붙인다 — 지금 main 재생에서 ${sumAfter((r) => r.turns.reduce((n, t) => n + t.forced, 0))}번. 그 항목(c…·v…)을 닫는 todo 호출은 대상이 없어 실패한다.</li>
<li><b>모델·그림·네트워크가 있어야 하는 호출</b> ${[...outside].map(([name, n]) => `${esc(name)} ${n}`).join(" · ") || "없음"} — generate_art 는 자리표시 그림으로 대신하고, 나머지는 부르되 결과를 믿지 않는다.</li>
<li><b>옛 명세를 지금 빌더로 돌릴 때</b>: 이름이 바뀐 도구(build_world → build_places)는 지금 이름으로 부른다 — ${sumAfter((r) => r.calls.renamed?.length ?? 0)}번. 그때는 받았는데 지금 규칙이 돌려보내는 청사진은 같은 것을 다시 보낸다(제품이 두 번 돌려보낸 뒤 함수가 메워서 건다) — ${afterReplays.filter((r) => r.calls.resent?.length).map((r) => esc(r.id)).join(" · ") || "없음"}. 그런 판은 그때와 다른 게임이 된다(아래 «같은 결과의 쓰기»가 낮다).</li>
<li><b>재생하지 못한 호출</b> ${sumAfter((r) => r.calls.total - r.calls.played)}개 / ${sumAfter((r) => r.calls.total)} · <b>지금 재생본에서 못 찾은 id</b>를 쓴 호출 ${sumAfter((r) => r.calls.unresolvedIds.length)}개(빌더가 달라져 그 이벤트가 없거나, 판정자 항목).</li>
<li><b>기계 «완료» 판정</b>은 그때 판정과 같지 않다(위 표의 마지막 열). 재생에는 편집기의 적용 검증·정규화가 없어 끝맺음 관문이 짚는 항목이 한두 개 다르고, 대본에는 그 항목을 고치는 호출이 없다. 전/후를 견주는 수로만 쓴다 — 지금 main 합계 ${esc(show(total.complete))}.</li>
<li><b>명세는 그때 빌더가 낸 결과에 대한 모델의 반응</b>이다. 빌더가 바뀌면 뒤쪽 고치기 호출(그때 생긴 이벤트 id 를 짚는 patch 등)은 과녁을 잃는다 — 표의 «그때와 같은 결과의 호출»이 그 수다.</li>
<li><b>공용 자료</b>: 재생은 이 기계의 공용 DB(<code>shared-content.sqlite</code> — 공용 캐릭터 칩·타일셋)를 편집기처럼 올린 뒤 빈 프로젝트를 만든다. 은행 파일에는 그 DB 가 없다 — 다른 기계에서는 사람 그림 고르기가 달라질 수 있다.</li>
<li>소금 기록이 없는 옛 판(2026-11-10 의 여덟 판)은 장소 이름에서 정한 소금으로 짓는다 — 저장본과 같은 배치는 아니고, 전/후 두 재생끼리만 같다.</li>
</ul>
<p class="lead">만든 때 ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · 문서 openwiki/assistant-v2.md 「명세 은행」</p>
</main></body></html>`;
fs.writeFileSync(out, html);
console.log(`${out}: ${(html.length / 1e6).toFixed(2)}MB · 판 ${specs.length} · 신뢰 ${trust.length} · 전/후 ${A.length}/${B.length} · 맵 짝 ${pairs.length}`);
void METRICS;

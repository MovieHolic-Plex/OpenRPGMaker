// 「손 도트 실내」 참고문서(atlas_biome_interior 번들 소유) → src/assets/sharedHandInteriorReferences.json
// + 그림 public/assets/hand-interior-references/*.png (원본 해상도, nearest 확대만) + md 사본 tiledata/hand-interior/v5-maps/refs/.
// AI-REFERENCE-CONTRACT 8항목: 사전(칸 번호·크기·층·통행) · 실행 순서 · 조립 예제 26맵(입력 → 네 층 정답 배열 → 완성 그림)
// · 반복/고정 조각 구분 · 정상/오류 그림(검사기가 코드·좌표로 잡는다) · 검사 범위 · 레이어 정정(옛 정의 → 새 정의).
// 사용: bun scripts/content/hand-interior/prepare-references.mts
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { analyseHandInteriorPlan, buildHandInteriorLayers, HAND_INTERIOR_SPEC as S, type HandInteriorInput } from "../../../src/editor/handInterior/builder.ts";
import { createAtlasBiomeInteriorTileset } from "../../../src/project/defaults/atlasBiomeInterior.ts";

const OUT = "src/assets/sharedHandInteriorReferences.json", PUB = "public/assets/hand-interior-references", MD = "tiledata/hand-interior/v5-maps/refs";
fs.mkdirSync(PUB, { recursive: true }); fs.mkdirSync(MD, { recursive: true });
const maps = JSON.parse(fs.readFileSync("tiledata/hand-interior/v5-maps/maps.json", "utf8"));
const meta = JSON.parse(fs.readFileSync("tiledata/hand-interior/v5/interior-meta.json", "utf8"));
const check = JSON.parse(fs.readFileSync("tiledata/hand-interior/v5-maps/check.json", "utf8"));
const tileset = createAtlasBiomeInteriorTileset();
const TID = "atlas_biome_interior", CAT = "hand-interior-v5";
const fence = (lang: string, body: string) => "```" + lang + "\n" + body + "\n```\n";
const rows = (a: number[], w: number) => fence("text", Array.from({ length: a.length / w }, (_, y) => a.slice(y * w, (y + 1) * w).map((t) => String(t).padStart(4)).join("")).join("\n"));
const render = (jobs: object[]) => execFileSync("python3", ["scripts/content/hand-interior/render_layers.py"], { input: JSON.stringify(jobs) });
const docs: { id: string; name: string; markdown: string }[] = [];
const images: { id: string; name: string; caption: string; dataUrl: string }[] = [];
const doc = (id: string, name: string, markdown: string) => { fs.writeFileSync(`${MD}/${id}.md`, markdown.trimEnd() + "\n"); docs.push({ id, name, markdown: markdown.trimEnd() + "\n" }); };
const image = (id: string, caption: string) => images.push({ id, name: `${id}.png`, caption, dataUrl: `/assets/hand-interior-references/${id}.png` });

// ── answer → tool arguments (the same call the assistant makes) ─────────────────────────────────────────────────────
function argsFor(p: { key: string; plan: string[]; floor: string; wall: string; zones: unknown[][]; ceil: string }) {
  const mm = meta.buildings.flatMap((b: { maps: unknown[] }) => b.maps).find((x: { id: string }) => x.id === p.key);
  const zones = p.zones.map(([x0, y0, x1, y1, floor, wall]) => ({ x0, y0, x1, y1, ...(floor ? { floor } : {}), ...(wall ? { wall } : {}) }));
  const A = analyseHandInteriorPlan(p.plan);
  const objects: { id: string; x: number; y: number }[] = [], lines: { id: string; cells: { x: number; y: number }[] }[] = [], goods: { id: string; x: number; y: number }[] = [];
  for (const it of mm.items) {
    // 원본이 벽·천장 위까지 그린 깔개 칸은 도구 입력에서 뺀다(구운 예제는 그 칸을 막힌 구조 칸에 구웠다)
    if (it.cells) { lines.push({ id: it.line, cells: it.cells.map(([a, b]: number[]) => ({ x: it.x + a!, y: it.y + b! })).filter((c: { x: number; y: number }) => A.isFloor(c.x, c.y)) }); continue; }
    objects.push({ id: it.id, x: it.x, y: it.y });
    for (const g of it.on ?? []) {
      const w = Math.max(1, it.w), h = Math.max(1, it.h);
      goods.push({ id: g.goods, x: it.x + Math.min(w - 1, Math.floor(g.fx * w)), y: it.y + Math.min(h - 1, Math.max(0, Math.ceil(g.fy * h) - 1)) });
    }
  }
  const input: HandInteriorInput & Record<string, unknown> = { plan: p.plan, floor: p.floor, wall: p.wall, ...(zones.length ? { zones } : {}), ...(p.ceil !== "default" ? { ceiling: p.ceil } : {}),
    objects, ...(lines.length ? { lines } : {}), goods, ...(mm.start ? { start: mm.start.map(([x, y]: number[]) => ({ x, y })) } : {}) };
  // drop goods the tool cannot seat (two goods on one cell, or the 4th layer already taken) — the baked answer keeps them
  let built = buildHandInteriorLayers(input, tileset);
  const bad = new Set(built.issues.filter((i) => i.code.startsWith("goods")).map((i) => `${i.x},${i.y}`));
  const seen = new Set<string>();
  input.goods = goods.filter((g) => { const k = `${g.x},${g.y}`; if (bad.has(k) || seen.has(k)) return false; seen.add(k); return true; });
  built = buildHandInteriorLayers(input, tileset);
  return { input, built, mm };
}

// ── 1. reading order + tool ────────────────────────────────────────────────────────────────────────────────────────
const byCat = new Map<string, string[]>();
for (const [id, o] of Object.entries(S.objects)) (byCat.get(`${o.category} ${o.category_ko}`) ?? byCat.set(`${o.category} ${o.category_ko}`, []).get(`${o.category} ${o.category_ko}`)!).push(id);
doc("hand-interior-v5-order", "손 도트 실내 · 읽는 순서·짓는 순서", `# 손 도트 실내 (atlas_biome_interior) — 읽는 순서

실내(집·가게·여관·저택·교회·성 방·지하)는 이 칩셋 하나로만 짓는다. 옛 실내 칩셋(easyrpg_chipset_interior · tibo_interior_expanded · LPC 가구)은 폐기됐다.
칩셋: \`atlas_biome_interior\`, 계열 \`oprn-atlas\`, 16px, 시트 가로 48칸, 칸 ${tileset.count}개(그림 public/assets/atlas-interior/interior-chipset.png).
원본: tiledata/hand-interior/v5(손 도트 Python, 건물 25동 26맵). 칸은 scripts/content/hand-interior/build_tileset.py 가 잘랐다.

## 읽는 순서
1. 이 문서 → 2. \`hand-interior-v5-rules\`(구조 규칙·사용자 판정) → 3. \`hand-interior-v5-dictionary\`(바닥·벽면·천장·탁자·줄·단 칸 번호) →
4. 짓는 건물과 가장 가까운 예제(\`hand-interior-v5-map-*\`: 입력 인자 + 네 층 정답 배열 + 그림) → 5. \`hand-interior-v5-errors\`(오류 그림과 코드).
가구는 \`list_hand_interior_parts({room:"빵집"})\`(방 종류·건물 → 예제에 쓰인 가구를 종류별로)와 \`{query:"여관 벽"}\`(설명·쓰는 방·놓는 곳·짝 소품까지)으로 찾는다.
\`hand-interior-v5-objects-*\`(가구 사전, 칸 번호 포함)는 도구 결과로 모자랄 때만 한 분류씩 읽는다.

## 짓는 순서 (한 번의 도구 호출)
1. 방 목록을 글로 먼저 정한다: 방마다 용도·앵커 가구·드나드는 문·손님/주인 동선. 공간이 남으면 맵을 줄인다.
2. \`plan\` 을 쓴다: '#' 막힘, '.' 실내. 외벽 한 칸 두께, 방 사이는 '#' 칸막이. 맨 아래 줄의 '.' 틈 = 거리 출입구.
3. \`floor\`·\`wall\` 기본값, 방마다 다르면 \`zones\`(칸막이 뒤 방 단위로만 벽 재질을 바꾼다).
4. 가구: \`objects\`(v5 가구 id, 좌표 = 발밑 왼쪽 위), 탁자·카운터 = \`tables\`(자동 타일, 아무 W×H), 깔개·울타리·창살 = \`lines\`, 단 = \`daises\`, 탁상 물건 = \`goods\`(윗면 가구 칸 위).
5. \`build_hand_interior_room\` 을 부른다. 벽면(막힌 칸 바로 아래 두 줄)·천장 띠·바닥 그림자는 도구가 plan 에서 만든다 — 손으로 칠하지 않는다.
6. 결과의 오류(error)는 맵을 만들지 않는다: 메시지의 좌표를 고쳐 다시 부른다. 경고(unreached-floor·unreachable-piece)는 가구가 길을 막은 것 — 고친다.
7. 층이 여럿이면 층마다 한 맵. 위로 가는 계단(\`stairs up wood/stone\`, 북쪽 벽 앞 3칸) 칸에 \`links\` 로 위층 도착 칸을, 위층의 \`stairwell down\` 칸에 아래층 도착 칸을 단다(도착 칸은 계단 바로 아래 바닥).
8. \`show_map_region\` 으로 그림을 확인하고, 이상한 곳을 고쳐 \`replace:true\` 로 다시 짓는다.

## 부품 id 찾기
\`list_hand_interior_parts\` — 인자 없이 = 바닥·벽면·천장·탁자·줄·단·탁상 물건 목록 + 가구 분류 + 방 종류·건물 id.
\`{room:"빵집"}\`·\`{room:"여관 객실"}\`·\`{room:"부엌"}\` = 예제 26맵을 방 단위로 나눠 그 방에 쓰인 가구를 종류(floor·wall·hang·flat·table·line·dais)별로, 쓰인 방 수·개수와 함께.
\`{query:"여관 벽"}\` = id·이름·분류·태그·설명을 모두 찾고 모든 낱말이 맞는 것만 준다. 12종 이하면 행마다 desc·tags·place·pair, 많으면 desc 한 줄.
\`{category}\` = 한 분류의 가구 행.
가구 분류(${byCat.size}): ${[...byCat].map(([k, v]) => `${k} ${v.length}`).join(" · ")}.

## 층과 통행 (엔진 판정)
- 1층 = 구조: 바닥(밟음 o) · 벽면(막힘 x) · 천장 띠·공허(막힘 x).
- 2층 = 바닥 무늬: 깔개·선로·단·배수 창살·아래로 가는 계단 구멍(밟음 o, 캐릭터 밑).
- 3·4층 = 가구 조각: 발밑 칸 = 막힘 x(캐릭터와 줄 순서로 겹침), 솟은 칸(발밑 위로 튀어나온 그림)·벽 걸이 = ★(캐릭터 위에 그리고 통행은 아래 층), 위로 가는 계단 발밑 = o.
- 탁상 물건 = 4층, 막힘 x(가구 칸 위에만).
`);

doc("hand-interior-v5-rules", "손 도트 실내 · 구조 규칙·사용자 판정", `# 구조 규칙 (tiledata/hand-interior/v5 conventions + 사용자 판정 2026-09-28)

## 평면 → 구조 (자동, 손으로 칠하지 않는다)
- ${meta.conventions.plan}
- 막힌 칸 중 실내에 닿는(8방) 칸 = 천장 띠(어두운 체크 + 방 쪽 밝은 테두리), 닿지 않는 칸 = 공허. 북쪽이 공허인 천장 칸은 윗줄 1px 가 공허색.
- 서쪽이 막힌 실내 칸(바닥·벽면)은 왼쪽 6px 그림자, 벽면 바로 아래 바닥 줄은 위 3px 접촉 그림자.
- 칸막이: ${meta.conventions.partition} 1~2줄 구멍은 벽면이 되어 길을 막는다(「부서진 방」 버그).
- 방은 사각형 하나가 아니다: 뒷방·곁방·칸막이·어긋난 북벽. 문 앞 현관, ㄱ자 방.

## 재질
- ${meta.conventions.wallMaterial}
- ${meta.conventions.floorByRoom}
- 불 쓰는 방(화덕·대장간·부엌)은 돌·타일 바닥 + 돌·타일 벽. 불 옆 나무 바닥은 틀렸다.

## 가구
- 벽 가구(kind wall: 선반·찬장·옷장·시계·화덕·벽난로·위로 가는 계단)는 북쪽 벽면 바로 아래 첫 바닥 줄에만.
- ${meta.conventions.hangings}
- ${meta.conventions.surfaces} 촛대·절구·저울을 바닥에 두지 않는다.
- 사람이 사는 방식대로: 주인은 뒷방에서 카운터 뒤로, 손님은 거리 문에서. 의자는 탁자를 향한다(${meta.conventions.chairFacing}). 책상 의자 = 책상 남쪽 chair N. 협탁은 침대 양옆. 모루는 화덕 앞 1~2칸, 담금 통 곁.
- 가게는 손님 동선: 진열을 둘러보고 → 출구 가까운 카운터에서 계산. 창고는 작게.
- 예배당 창은 좌우 대칭·같은 간격, 제단 뒤 큰 창.
- 저택 = 여러 층(층마다 맵, 계단 칸 맞춤), 복도·응접실·식당·부엌·하녀 방·안방·서재·손님방.
- 계단(위로): 북쪽 벽 앞 3칸, 첫 바닥 줄 + 벽면 두 줄을 덮고 벽 속으로 오른다. 방 가운데·옆벽 금지. 아래로: 바닥의 1×1 구멍(stairwell down).

## 통행 (반드시)
- ${meta.conventions.passage}
- 의자가 문을 막지 않는다(빵집 버그). 사용 칸 = 가구 앞·옆의 걸을 수 있는 칸(앉는 가구 옆이면 그 의자를 거쳐도 된다).
- 도구가 BFS 를 돌려 닿지 못한 빈 바닥·쓸 수 없는 가구를 경고로 준다. 검사 범위: 구조·통행·겹침·벽 가구 자리·걸이 줄·탁상 물건 자리. 이벤트 실행·미적 품질은 검사하지 않는다.

## 반복 조각과 고정 조각
- 반복: 바닥(표면마다 짜임 주기 cols×rows 칸 × 그림자 4 — 판자·줄눈 간격의 배수라 이음매가 줄눈에 떨어진다), 벽면(cols 열 × 2줄 × 서쪽 그림자 — 기둥·지지목 간격의 배수), 천장(이웃 32), 탁자 자동 타일, 줄 자동 타일, 단.
- 고정: 가구(발밑 칸 + 솟은 칸, 칸 번호가 정해져 있다), 탁상 물건, 문틀(round arch), 계단.
- 출입구 = 맨 아래 줄 '.' 틈(문 그림 없음, 거리에서 걸어 들어온다). 층 이동 = 계단 칸의 이동 이벤트(links). 문 앞 접근 칸 = 출입구 바로 위 바닥 두 줄(비워 둔다).
`);

const dict = {
  tilesetId: TID, tileSize: 16, tilesPerRow: tileset.tilesPerRow, count: tileset.count, blank: S.blank, void: S.void,
  floors: Object.fromEntries(Object.entries(S.floors).map(([id, f]) => [id, { ko: f.ko, first: f.tiles[0], cols: f.cols, rows: f.rows, index: `first + ((y%${f.rows})*${f.cols} + x%${f.cols})*4 + shadow(0 없음·1 벽면 밑·2 서쪽·3 둘 다)` }])),
  walls: Object.fromEntries(Object.entries(S.walls).map(([id, w]) => [id, { ko: w.ko, cols: w.cols, tiles: w.tiles, index: `((row-1)*${w.cols} + x%${w.cols})*2 + west` }])),
  ceilings: Object.fromEntries(Object.entries(S.ceilings).map(([id, t]) => [id, { tiles: t, bits: "1 남쪽 안 · 2 북쪽 안 · 4 서쪽 안 · 8 동쪽 안 · 16 북쪽 공허" }])),
  tables: Object.fromEntries(Object.entries(S.tables).map(([id, t]) => [id, { ko: t.ko, oneRow: t.oneRow, overhangPx: t.up, pieces: t.pieces }])),
  lines: Object.fromEntries(Object.entries(S.lines).map(([id, l]) => [id, { ko: l.ko, walkable: l.kind === "flat", overhangPx: l.up, pieceKeys: Object.keys(l.pieces).length }])),
  daises: Object.fromEntries(Object.entries(S.daises).map(([id, d]) => [id, { ko: d.ko, pieces: d.pieces }])),
  goods: S.goods,
};
doc("hand-interior-v5-dictionary", "손 도트 실내 · 사전(바닥·벽면·천장·탁자·줄·단·탁상 물건)", `# 사전 — 칸 번호(0기준, 시트 48칸 폭, 16px)

조각 키: 탁자·단 = 열(S 한 칸 · L 왼쪽 · M 가운데 · R 오른쪽) + 줄(S 한 줄 · T 위 · M 가운데 · B 아래)[+ 단은 체크 칸 (i+j)%2].
탁자 조각 값 = [dx, dy, 칸, 층] — dy -1 은 발밑 위로 솟은 칸(★). 줄 자동 타일 조각 키 = 4방 이웃(N E S W, 없으면 0) + 안쪽 모서리(Ne Es Sw Wn).
build_hand_interior_room 이 이 사전으로 칸을 고르므로 조수는 번호를 직접 칠하지 않는다. 번호는 검수·수리용이다.

${fence("json", JSON.stringify(dict))}`);

for (const [k, ids] of [...byCat].sort()) {
  const [cat, ko] = k.split(" ");
  const body = ids.map((id) => { const o = S.objects[id]!; return { id, ko: o.ko, kind: o.kind, w: o.w, h: o.h, overhangPx: o.up, ...(o.surface ? { surface: o.surface } : {}), ...(o.stairs ? { stairs: o.stairs } : {}), ...(o.animated ? { animated: true } : {}), cells: o.cells }; });
  const desc = ids.map((id) => { const m = meta.objects.find((x: { id: string }) => x.id === id); const o = S.objects[id]!; return `- \`${id}\` ${o.ko} — ${m?.description ?? ""} ${(m?.placement ?? []).join(" / ")}${o.tags?.length ? ` · 쓰는 방: ${o.tags.join("·")}` : ""}${o.pair?.length ? ` · 짝: ${o.pair.join(", ")}` : ""}`; }).join("\n");
  doc(`hand-interior-v5-objects-${cat}`, `손 도트 실내 · 가구 사전 · ${ko}`, `# 가구 사전 — ${ko} (${ids.length}종)

cells = [dx, dy, 칸, 층] (발밑 왼쪽 위 기준). kind: floor 바닥 가구(막힘) · wall 북쪽 벽 앞(막힘) · hang 벽면 윗줄 걸이(★) · flat 밟는 바닥 무늬(2층).

${desc}

${fence("json", JSON.stringify(body))}`);
}

// ── 2. the 26 example maps ─────────────────────────────────────────────────────────────────────────────────────────
render([{ out: `${PUB}/hand-interior-sheet.png`, width: 1, height: 1, lowerTiles: [] }]);
fs.copyFileSync("public/assets/atlas-interior/interior-chipset.png", `${PUB}/hand-interior-sheet.png`);
image("hand-interior-sheet", `시트 전체(원본 해상도, 48칸 폭, ${tileset.count}칸). 위 = 공허·천장·바닥·벽면, 가운데 = 가구·자동 타일·탁상 물건, 끝 = 예제 합성 칸.`);
const exampleCheck: { map: string; errors: number; warnings: number; reachable: number }[] = [];
const jobs: object[] = [];
for (const p of maps.plans) {
  const m = maps.maps[p.id];
  const { input, built } = argsFor(p);
  const c = check.find((r: { map: string }) => r.map === p.key);
  exampleCheck.push({ map: p.key, errors: built.issues.filter((i) => i.severity === "error").length, warnings: built.issues.filter((i) => i.severity === "warning").length, reachable: built.reachable });
  jobs.push({ out: `${PUB}/hand-interior-${p.key}.png`, ...m });
  image(`hand-interior-${p.key}`, `${p.name}(${p.building}) 완성 그림 — 번들 예제 맵 ${p.id} 의 네 층을 시트로 쌓은 원본 해상도 그림(12프레임 중 0번).`);
  const links = (m.events as { x: number; y: number; pages: { commands: { mapId: string; x: number; y: number }[] }[] }[]).map((e) => `(${e.x},${e.y}) → ${e.pages[0]!.commands[0]!.mapId} (${e.pages[0]!.commands[0]!.x},${e.pages[0]!.commands[0]!.y})`);
  doc(`hand-interior-v5-map-${p.key}`, `손 도트 실내 · 예제 · ${p.name}`, `# 예제 — ${p.name} (${p.building})

맵 ${p.id} · ${m.width}×${m.height} · 바닥 ${p.floor} · 벽 ${p.wall} · 천장 ${p.ceil}. 방: ${p.rooms.map((r: unknown[]) => r[0]).join(" · ")}.
원본 검사(build_tileset.py): 원본 합성과 픽셀 차 ${c.pixelDiffAllFrames}(12프레임 전부) · 통행 격자 불일치 ${c.walkMismatch} · 닿는 칸 ${c.reachable}.
${links.length ? `층 이동: ${links.join(" · ")}` : ""}
그림: \`hand-interior-${p.key}\`. 좌표를 그대로 복사하지 말고 방 짜임(칸막이·문·동선·가구 무리)을 배운다.

## 평면
${fence("text", p.plan.join("\n"))}
## build_hand_interior_room 인자 (같은 방을 도구로 다시 짓는 입력 — 도구 검사 오류 ${exampleCheck.at(-1)!.errors}, 경고 ${exampleCheck.at(-1)!.warnings})
탁상 물건은 칸 단위로 얹는다(번들 예제는 윗면 안 위치까지 구운 합성 칸이라 조금 다르다).
${fence("json", JSON.stringify({ mapId: p.id, name: p.name, ...input }))}
## 정답 배열 (번들 예제, 층별 칸 번호, -1 = 빈 칸)
1층 lowerTiles
${rows(m.lowerTiles, m.width)}2층 lowerOverlayTiles
${rows(m.lowerOverlayTiles, m.width)}3층 upperTiles
${rows(m.upperTiles, m.width)}4층 upperOverlayTiles
${rows(m.upperOverlayTiles, m.width)}`);
}
render(jobs);

// ── 3. normal vs broken (the builder must catch each) ───────────────────────────────────────────────────────────────
const bakery = maps.plans.find((p: { key: string }) => p.key === "bakery");
const base = argsFor(bakery).input;
const variants: { id: string; title: string; mutate: (i: HandInteriorInput & Record<string, unknown>) => HandInteriorInput }[] = [
  { id: "doorway-blocked", title: "굽는 방 문 틈 바로 아래를 통이 막음", mutate: (i) => ({ ...i, objects: [...i.objects!, { id: "barrel", x: 5, y: 7 }] }) },
  { id: "hang-on-floor", title: "그림(걸이)을 바닥 줄에 걺", mutate: (i) => ({ ...i, objects: [...i.objects!, { id: "picture", x: 6, y: 10 }] }) },
  { id: "wall-piece-mid-floor", title: "벽 가구(빵 선반)를 방 가운데에", mutate: (i) => ({ ...i, objects: [...i.objects!, { id: "bread shelf", x: 12, y: 10 }] }) },
  { id: "closed-doorway", title: "굽는 방으로 가는 칸막이 틈을 막음 — 방에 닿지 못함", mutate: (i) => ({ ...i, plan: i.plan.map((r, y) => (y === 6 ? r.slice(0, 5) + "#" + r.slice(6) : r)) }) },
  { id: "stairs-mid-floor", title: "위로 가는 계단을 방 가운데에", mutate: (i) => ({ ...i, objects: [...i.objects!, { id: "stairs up wood", x: 10, y: 10 }] }) },
  { id: "goods-on-floor", title: "탁상 물건을 바닥에", mutate: (i) => ({ ...i, goods: [...(i.goods ?? []), { id: "cashbox", x: 7, y: 11 }] }) },
];
const errRows: string[] = [];
const errJobs: object[] = [];
const good = buildHandInteriorLayers(base, tileset);
for (const v of variants) {
  const broken = buildHandInteriorLayers(v.mutate(structuredClone(base) as never), tileset);
  const found = broken.issues.filter((i) => !good.issues.some((g) => g.message === i.message));
  if (!found.length) throw new Error(`variant ${v.id} not caught`);
  const marks = found.filter((i) => i.x !== undefined).map((i) => ({ x: i.x, y: i.y }));
  for (const u of broken.unreachedFloor.slice(0, 40)) marks.push({ x: u.x, y: u.y });
  errJobs.push({ out: `${PUB}/hand-interior-error-${v.id}.png`, width: broken.width, height: broken.height, lowerTiles: broken.lowerTiles, lowerOverlayTiles: broken.lowerOverlayTiles, upperTiles: broken.upperTiles, upperOverlayTiles: broken.upperOverlayTiles, marks, scale: 2 });
  image(`hand-interior-error-${v.id}`, `오류 그림 — ${v.title}. 빨간 칸 = 검사기가 짚은 칸(${found.map((f) => f.code).join(", ")}).`);
  errRows.push(`| ${v.id} | ${v.title} | ${[...new Set(found.map((f) => f.code))].join(", ")} | ${found.slice(0, 3).map((f) => f.message).join(" / ")} |`);
}
errJobs.push({ out: `${PUB}/hand-interior-error-normal.png`, width: good.width, height: good.height, lowerTiles: good.lowerTiles, lowerOverlayTiles: good.lowerOverlayTiles, upperTiles: good.upperTiles, upperOverlayTiles: good.upperOverlayTiles, scale: 2 });
image("hand-interior-error-normal", "정상 그림 — 빵집을 build_hand_interior_room 으로 지은 것(2배 nearest). 오류 그림들과 나란히 비교한다.");
render(errJobs);
doc("hand-interior-v5-errors", "손 도트 실내 · 정상/오류 그림과 검사 코드", `# 정상/오류 — 빵집을 하나씩 부순 입력

정상: \`hand-interior-error-normal\`(도구 오류 ${good.issues.filter((i) => i.severity === "error").length}, 닿는 칸 ${good.reachable}). 아래 입력을 실제로 도구에 넣으면 이 코드가 나온다(error 는 맵을 만들지 않는다).

| 그림 | 바꾼 것 | 코드 | 메시지(좌표) |
|---|---|---|---|
${errRows.join("\n")}

## 레이어 정정 (옛 정의 → 새 정의, 엔진 판정 기준)
- 옛 atlas_biome_interior(2026-09-29 오전)는 Tibo 실내 칸 번호(0~2159) + 배·던전 블록이었다. 손 도트 v5 전용으로 **통째로 바꿨다** — 칸 번호가 전혀 다르다.
  배·던전 블록은 \`atlas_biome_dungeon\` 으로 떼었다. 옛 정의로 깐 맵은 저장본에 남아 있으면 그대로 두고 경고만 남긴다(다시 지어야 한다).
- 투명 여부·홈 레이어·통행·렌더 순서는 따로다: 가구 발밑 칸은 투명 배경(3층 홈)이지만 통행은 막힘 x(캐릭터와 줄 순서로 겹침),
  솟은 칸은 투명·3층 홈·★(캐릭터 위, 통행은 아래 층), 바닥 무늬는 투명·2층·o. 이 정의는 RM2k3 투명 칸 표 자동 보정(ensureTilesetHarnesses)에서 빠진다 —
  빠지지 않으면 0~479칸(천장·바닥·벽면)이 RM2k3 칩셋 번호표대로 윗층(upper)으로 올라가 층 홈·깊이가 어긋난다.
- 검증: 26맵 모두 이 정의의 통행으로 BFS 한 결과가 원본 정답 격자(# = X . c u S D ,)와 칸마다 같다(불일치 0).
`);

// ── bundle ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const category = { id: CAT, name: "손 도트 실내 (v5)", description: "atlas_biome_interior 로 실내를 짓는 법: 읽는 순서·구조 규칙·사전·가구 사전·예제 26맵(입력 인자 + 네 층 정답 배열 + 그림)·정상/오류 그림. 도구 build_hand_interior_room.", documents: docs, images };
if (docs.length > 64 || images.length > 256) throw new Error(`limits: ${docs.length} docs, ${images.length} images`);
for (const d of docs) if (d.markdown.length > 120_000) throw new Error(`${d.id} too long ${d.markdown.length}`);
fs.writeFileSync(OUT, JSON.stringify([{ tilesetId: TID, category }]) + "\n");
fs.writeFileSync("tiledata/hand-interior/v5-maps/example-tool-check.json", JSON.stringify(exampleCheck, null, 1) + "\n");
console.log({ docs: docs.length, images: images.length, bytes: fs.statSync(OUT).size, exampleToolErrors: exampleCheck.filter((e) => e.errors).map((e) => e.map) });

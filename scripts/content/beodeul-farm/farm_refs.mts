// 버들항 농장 참고문서 — farm_scenes.mts --refs 가 부른다(장면·검사를 같은 실행에서 쓴다).
// 쓰는 것: tiledata/beodeul-farm/{README.md,EXAMPLE.md,example.json,errors.json} · public/assets/beodeul-farm/*.png ·
//          src/assets/beodeulCityReferences.json 의 용도 `beodeul-farm`(번들 소유, 문서·그림 id 는 bd- 머리).
// 계약: tiledata/AI-REFERENCE-CONTRACT.md(사전·실행 순서·완전 조립 예제·입력→배열→원본 그림·정상/오류·검사 범위).
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import type { GameMap, Project, TilesetDef } from "../../../src/project/types.ts";
import { renderMapPng } from "../../qa-game/render.mts";

type Scene = { id: string; name: string; map: GameMap; occ: Map<number, string>; notes: string[]; doors: Array<{ x: number; y: number; kit: string }> };
type Defect = { code: string; x: number; y: number; note: string };
type Ctx = { p: Project; ts: TilesetDef; made: Scene[]; checkFarm: (s: Scene, ts: TilesetDef) => Defect[]; FENCE: Record<string, number>; CROP: Record<string, number>; OUT: string; ROOT: string };

function readPng(buf: Buffer) { return PNG.sync.read(buf); }
function blank(w: number, h: number, rgba = [24, 24, 28, 255]) {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) png.data.set(rgba, i * 4);
  return png;
}
function blit(dst: PNG, src: PNG, sx: number, sy: number, w: number, h: number, dx: number, dy: number, scale = 1) {
  for (let y = 0; y < h * scale; y++) for (let x = 0; x < w * scale; x++) {
    const X = sx + Math.floor(x / scale), Y = sy + Math.floor(y / scale);
    if (X < 0 || Y < 0 || X >= src.width || Y >= src.height) continue;
    const tx = dx + x, ty = dy + y;
    if (tx < 0 || ty < 0 || tx >= dst.width || ty >= dst.height) continue;
    const si = (Y * src.width + X) * 4, di = (ty * dst.width + tx) * 4;
    const a = src.data[si + 3]! / 255;
    for (let c = 0; c < 3; c++) dst.data[di + c] = Math.round(src.data[si + c]! * a + dst.data[di + c]! * (1 - a));
    dst.data[di + 3] = 255;
  }
}
function box(dst: PNG, x: number, y: number, w: number, h: number, rgb = [255, 40, 40]) {
  for (let i = 0; i < w; i++) for (const yy of [y, y + h - 1]) { const di = (yy * dst.width + x + i) * 4; if (di >= 0 && di < dst.data.length) dst.data.set([...rgb, 255], di); }
  for (let i = 0; i < h; i++) for (const xx of [x, x + w - 1]) { const di = ((y + i) * dst.width + xx) * 4; if (di >= 0 && di < dst.data.length) dst.data.set([...rgb, 255], di); }
}

export function writeFarmReferences(ctx: Ctx) {
  const { p, ts, made, checkFarm, FENCE, CROP, ROOT } = ctx;
  const DATA = path.join(ROOT, "tiledata/beodeul-farm"), IMG = path.join(ROOT, "public/assets/beodeul-farm");
  fs.mkdirSync(DATA, { recursive: true }); fs.mkdirSync(IMG, { recursive: true });
  const sheet = readPng(fs.readFileSync(path.join(ROOT, "public/assets/beodeul-city/beodeul-city-chipset.png")));

  // ---- 칸 사전 그림: 꼬리 6행 × 27열, 3배 ----
  const atlas = blank(27 * 16 * 3, 6 * 16 * 3, [40, 44, 48, 255]);
  blit(atlas, sheet, 0, 216 * 16, 27 * 16, 6 * 16, 0, 0, 3);
  fs.writeFileSync(path.join(IMG, "atlas.png"), PNG.sync.write(atlas));

  // ---- 장면 그림(원본 해상도) ----
  for (const s of made) fs.writeFileSync(path.join(IMG, `${s.id}.png`), renderMapPng(p, s.map).png);

  // ---- 정상/오류: 농가 장면을 실제로 변조해 검사가 잡는지 ----
  const farm = made.find((s) => s.id === "farm_farmstead")!;
  const dry = ts.autotileGroups!.find((g) => g.id === "farmland")!;
  const tampers: Array<{ id: string; code: string; at: [number, number]; caption: string; apply: (m: GameMap) => void }> = [
    { id: "fence-gap", code: "fence-gap", at: [19, 14], caption: "목장 울타리 서쪽 세로 한 칸을 뺐다", apply: (m) => { (m.upperTiles as number[])[14 * m.width + 19] = -1; } },
    { id: "crop-off-soil", code: "crop-off-soil", at: [16, 4], caption: "익은 배추를 밭 밖 풀 위에 얹었다", apply: (m) => { (m.upperTiles as number[])[4 * m.width + 16] = CROP.cabbage_mature!; } },
    { id: "door-unreached", code: "door-unreached", at: [10, 8], caption: "닭장 문 앞 모랫길 칸을 풀로 바꿨다", apply: (m) => { (m.lowerTiles as number[])[8 * m.width + 10] = 737; } },
    { id: "edge-mismatch", code: "farmland-edge-mismatch", at: [18, 3], caption: "밭 왼쪽 위 모서리 칸을 몸통 칸으로 바꿨다(둑·풀 테가 사라진다)", apply: (m) => { (m.lowerTiles as number[])[3 * m.width + 18] = dry.variantMap["255"]!; } },
  ];
  const errors: Array<Record<string, unknown>> = [];
  const images: Array<{ id: string; name: string; caption: string; dataUrl: string }> = [];
  const normalPng = readPng(renderMapPng(p, farm.map).png);
  for (const t of tampers) {
    const m = structuredClone(farm.map); t.apply(m);
    const sc: Scene = { ...farm, map: m, notes: [] };
    const found = checkFarm(sc, ts).filter((d) => d.code === t.code);
    const hit = found.some((d) => Math.abs(d.x - t.at[0]) <= 1 && Math.abs(d.y - t.at[1]) <= 1);
    errors.push({ id: t.id, code: t.code, at: t.at, caption: t.caption, detected: hit, defects: found });
    const errPng = readPng(renderMapPng(p, m).png);
    const [cx, cy] = t.at, R = 4, S = 3, w = (2 * R + 1) * 16;
    const pair = blank(w * S * 2 + 12, w * S);
    const x0 = (cx - R) * 16, y0 = (cy - R) * 16;
    blit(pair, normalPng, x0, y0, w, w, 0, 0, S);
    blit(pair, errPng, x0, y0, w, w, w * S + 12, 0, S);
    box(pair, w * S + 12 + R * 16 * S, R * 16 * S, 16 * S, 16 * S);
    fs.writeFileSync(path.join(IMG, `err-${t.id}.png`), PNG.sync.write(pair));
    images.push({ id: `bd-farm-err-${t.id}`, name: `정상/오류 · ${t.code}`, dataUrl: `/assets/beodeul-farm/err-${t.id}.png`,
      caption: `왼쪽 정상 · 오른쪽 오류(빨간 상자 = 맵 칸 (${cx},${cy})). ${t.caption}. 검사 코드 ${t.code} ${hit ? "검출" : "미검출"}. 실제 시트 조립을 3배 최근접 확대.` });
  }
  fs.writeFileSync(path.join(DATA, "errors.json"), JSON.stringify(errors, null, 1) + "\n");

  // ---- 완전 조립 예제(농가) 배열 ----
  const W = farm.map.width;
  const grid = (a: number[]) => Array.from({ length: farm.map.height }, (_, y) => a.slice(y * W, y * W + W));
  const example = { tilesetId: "beodeul_city", width: W, height: farm.map.height, tileSize: 16,
    lowerTiles: grid(farm.map.lowerTiles as number[]), upperTiles: grid(farm.map.upperTiles as number[]), doors: farm.doors };
  fs.writeFileSync(path.join(DATA, "example.json"), JSON.stringify(example) + "\n");

  const F = FENCE, C = CROP;
  const dryIds = (n: string) => ({ NW: 27648, N: 27649, NE: 27650, inNW: 27651, inNE: 27652, W: 27776, body: 27777, E: 27778, inSW: 27779, inSE: 27780, SW: 27904, S: 27905, SE: 27906, iso: 27907 } as Record<string, number>)[n]!;
  const kits = (ts.structureKits ?? []).filter((k) => k.id.startsWith("bd-farm-"));
  const guide = `# 버들항 농장 — 경작지·작물·울타리·헛간 (beodeul_farm 2판, 2026-10-14)

타일셋 \`beodeul_city\` · 그림 \`public/assets/beodeul-city/beodeul-city-chipset.png\`(텍스처 \`tex_beodeul_city\`) · **16px 칸, 한 줄 128칸**.
번호 n 의 칸 = 행 ⌊n/128⌋, 열 n mod 128, 원본 픽셀 (열×16, 행×16). 농장 칸은 시트 꼬리 **27,648~28,415**(행 216~221)이다. 다른 칩셋 번호를 섞지 않는다.
그림은 코드 손 도트(scripts/content/beodeul-farm/farm_art.py), 3/4 탑뷰: 울타리 말뚝 머리·가로대·헛간 지붕은 윗면이 보이고, 경작지는 둑 윗테와 앞면이 있다.

## 1. 정확한 사전

| 무엇 | 칸 번호 | 층 | 통행 | 반복 |
|---|---|---|---|---|
| 마른 경작지 오토타일 \`farmland\` (14역할) | NW ${dryIds("NW")} · N ${dryIds("N")} · NE ${dryIds("NE")} · W ${dryIds("W")} · 몸통 ${dryIds("body")} · E ${dryIds("E")} · SW ${dryIds("SW")} · S ${dryIds("S")} · SE ${dryIds("SE")} · 외딴 ${dryIds("iso")} · 오목 inNW ${dryIds("inNW")} · inNE ${dryIds("inNE")} · inSW ${dryIds("inSW")} · inSE ${dryIds("inSE")} | 아래(1층) | 걸음 | 반복(오토타일) |
| 물 준 경작지 \`farmland_watered\` | 마른 흙 번호 + 6 (예: 몸통 ${dryIds("body") + 6}) | 아래 | 걸음 | 반복 |
| 작물(투명 바탕, 경작지 위에만) | 밀 싹 ${C.wheat_sprout} · 밀 자람 ${C.wheat_young} · 밀 익음 ${C.wheat_mature} · 배추 싹 ${C.cabbage_sprout} · 배추 자람 ${C.cabbage_young} · 배추 익음 ${C.cabbage_mature} · 토마토 싹 ${C.tomato_sprout} · 토마토 자람 ${C.tomato_young} · 토마토 익음 ${C.tomato_mature} · 씨 뿌림 ${C.seeded} | 위(3층) | 걸음 | 반복(줄 단위) |
| 울타리 | 가로 ${F.h} · 세로 ${F.v} · 모서리 NW ${F.cNW} · NE ${F.cNE} · SW ${F.cSW} · SE ${F.cSE} · 문 ${F.gate} · 가로 서쪽 끝 ${F.endW} · 가로 동쪽 끝 ${F.endE} · 세로 북쪽 끝 ${F.vN} · 세로 남쪽 끝 ${F.vS} · 말뚝 하나 ${F.post} · 세로(동쪽 둘레) ${F.vE} | 위 | 막힘 | 반복(가로·세로), 고정(모서리·끝·문) |
| 헛간 6×6 키트 \`bd-farm-barn\` | 행 216~221 열 16~21 | 위 | 위 3줄 ★(사람 뒤), 아래 3줄 막힘 | 고정(키트로만) |
| 닭장 3×3 키트 \`bd-farm-coop\` | 행 216~218 열 24~26 | 위 | 위 1줄 ★, 아래 2줄 막힘 | 고정 |

- 오토타일 그룹 \`farmland\` 는 8이웃(neighborhood 8). 칠한 칸들의 이웃 마스크로 역할이 정해진다 — 몸통 번호만 깔고 끝내지 않는다(둑·풀 테가 사라진다, 오류 farmland-edge-mismatch).
- 경작지 가장자리 칸은 바깥 2화소가 풀(버들항 잔디 737 결)이라 풀밭 위에 바로 놓인다. 모랫길에 붙여도 풀 테 2화소가 둑처럼 남는다.
- **농사 런타임 계약**: \`renderFarmOverlays\`(src/player/playSceneFarming.ts)는 맵 타일셋의 \`farmland\` 그룹으로 경작한 칸을 그리고, 물 준 칸은 \`farmland_watered\` 의 같은 마스크 칸으로 그린다(그룹이 없으면 틴트). 런타임 작물은 타일이 아니라 등록 스프라이트(\`cropGraphicStages\`)다 — 위 작물 칸은 맵에 손으로 놓는 그림이다.

## 2. 실행 순서(맵에 농장을 깔 때)

1. **용도부터**: 밭 덩이(4×3~8×5)·농가 마당(헛간+닭장+우물·물통·건초)·목장(울타리 안 풀밭)을 정하고 그 사이를 **폭 2칸 흙길(모랫길 \`beodeul_sand_autotile\`)** 로 잇는다. 폭 1칸 길은 오토타일 테만 남아 울퉁불퉁한 띠가 된다.
2. 땅(풀 737) → 길(모랫길 오토타일) → **경작지 오토타일**(덩이째 칠한 뒤 둘레를 다시 맞춘다).
3. 작물: 경작지 칸 위 윗층에 한 칸씩, **한 가로 줄 = 한 작물·한 단계**. 뒤(북) 줄부터 익음 → 자람 → 싹 → 씨 뿌림 순이면 자라는 밭이 된다. 경작지 밖(풀·길)에는 얹지 않는다(crop-off-soil).
4. 울타리: 밭·목장 **한 칸 바깥**을 빈틈 없이 두른다 — 위 줄 \`cNW, h…, cNE\`, 왼쪽 옆 \`v\`·오른쪽 옆 \`vE\`(세로 가로대가 말뚝 바깥 옆면에 붙는다), 아래 줄 \`cSW, h…(문 하나), cSE\`. 끊긴 줄은 끝 말뚝(\`endW/endE/vN/vS\`)으로 닫는다(fence-gap).
5. 울타리 문(\`gate\`)·헛간·닭장 문 아래 칸은 흙길이어야 한다(door-unreached). 문 칸 자체는 막힘이다.
6. 건물·울타리는 경작지 흙 위에 놓지 않는다(object-on-soil). 기물끼리 윗층 칸을 겹치지 않는다(overlap).
7. 소품(건초·물통·상자·우물)은 마당·길가에 덩이로 둔다. 빈 풀 위에 한 줄로 늘어놓지 않는다.

금지: 들판 한 띠를 통째로 경작지로 덮기(용도 없는 평면 채우기), 경작지 몸통 번호만 깔기, 폭 1칸 길, 문 앞 막기, 사람 모양 허수아비를 새로 그려 넣기.

## 3. 완전 조립 예제
- **울타리 두른 밭** 키트 \`bd-farm-fenced-plot\`(7×6): 둘레 울타리 + 안쪽 밭 5×4(밀 익음·자람, 배추 익음·자람) + 아래 가운데 문.
- **농가 30×22** 전체 하위/상위 배열: 문서 「농장 조립 예제 배열」과 tiledata/beodeul-farm/example.json, 원본 그림 \`/assets/beodeul-farm/farm_farmstead.png\`.
- 그 밖의 키트: ${kits.map((k) => `\`${k.id}\` ${k.width}×${k.height}`).join(" · ")}.
- 이 판에 **없는 것**: 사람 모양 허수아비(새로 그리지 않음 — 필요하면 기존 \`bd-pick-wheat-roman-road-scarecrow\`), 동물(런타임 동물 캐릭셋을 쓴다), 풍차(기존 \`bd-windmill\`)·우물(\`bd-prop-well_roofed\`)·물통·건초·상자(기존 bd-pick-* 키트).

## 4. 자동 검사 범위
\`scripts/content/beodeul-farm/farm_scenes.mts\` 의 \`checkFarm\`: crop-off-soil · farmland-edge-mismatch · fence-gap · gate-blocked · door-unreached · object-on-soil · overlap. **구조·통행만** 본다 — 미적 품질·밀도·이벤트 실행은 보지 않는다(사람과 판정자가 그림으로 본다).
정상/오류 그림 넷은 이 검사가 실제로 변조를 잡는지 보인다(tiledata/beodeul-farm/errors.json).
`;
  const exampleMd = `# 농장 조립 예제 배열 — 농가 30×22 (beodeul_city)

입력: farm_scenes.mts 「농가」 장면(헛간 bd-farm-barn (2,2), 닭장 bd-farm-coop (10,5), 울타리 밭 bd-farm-fenced-plot (17,2), 우물 bd-prop-well_roofed (14,5),
흙 마당·길 모랫길 오토타일, 살림집 bd-house-h103_1 (2,13), 목장 울타리 9×7 (19,11) 문 (23,17)).
문 앞 칸(문 칸 아래): ${farm.doors.map((d) => `${d.kit} (${d.x},${d.y + 1})`).join(" · ")}.
-1 은 그 층이 비었다는 뜻이다. lowerTiles = 1층, upperTiles = 3층.

\`\`\`json
${JSON.stringify(example)}
\`\`\`
`;
  fs.writeFileSync(path.join(DATA, "README.md"), guide);
  fs.writeFileSync(path.join(DATA, "EXAMPLE.md"), exampleMd);
  const category = {
    id: "beodeul-farm", name: "버들항 · 농장(경작지·작물·울타리·헛간)",
    description: "농장 칸 사전(27,648~), 밭·울타리·농가 조립 순서, 농가 전체 배열, 정상/오류 그림. 농사 런타임이 읽는 farmland 그룹 계약.",
    documents: [
      { id: "bd-farm-guide", name: "농장 칸 사전·실행 순서·검사 범위", markdown: guide },
      { id: "bd-farm-example", name: "농장 조립 예제 배열(농가 30×22)", markdown: exampleMd },
    ],
    images: [
      { id: "bd-farm-atlas", name: "농장 칸 전체(시트 행 216~221, 열 0~26)", caption: "3배 최근접 확대. 왼쪽 위부터 마른 흙 14역할(열 0~4), 물 준 흙(열 6~10), 헛간(열 16~21), 닭장(열 24~26), 행 220 작물 10, 행 221 울타리 12.", dataUrl: "/assets/beodeul-farm/atlas.png" },
      ...made.map((s) => ({ id: `bd-farm-scene-${s.id.replace("farm_", "")}`, name: `조립 장면 · ${s.name}`, caption: `원본 해상도 ${s.map.width * 16}×${s.map.height * 16}, 엔진 렌더러(renderMapPng). 구조 검사 결함 ${checkFarm(s, ts).length}.`, dataUrl: `/assets/beodeul-farm/${s.id}.png` })),
      ...images,
    ],
  };
  const refPath = path.join(ROOT, "src/assets/beodeulCityReferences.json");
  const refs = JSON.parse(fs.readFileSync(refPath, "utf8")) as Array<{ id: string }>;
  const i = refs.findIndex((c) => c.id === category.id);
  if (i < 0) refs.push(category); else refs[i] = category;
  // prepare-beodeul-city-references.py 와 같은 꼴(파이썬 json indent=0)로 쓴다 — 구조 줄바꿈만, 들여쓰기 없음.
  fs.writeFileSync(refPath, JSON.stringify(refs, null, 1).replace(/\n +/g, "\n") + "\n");
  console.log(JSON.stringify({ refs: category.documents.length, images: category.images.length, errors: errors.map((e) => `${e.id}:${e.detected}`) }));
}

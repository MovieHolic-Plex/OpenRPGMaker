/**
 * 공용 오브젝트 게이트 — 3/4 시점 판정 규칙(판정자 지시문·종류별 기준·판정 계산). 브라우저·노드 공용(의존 없음).
 *
 * 배경(2026-10-08): 무림·던전 기물 판에서 윗면 없는 정면 입면도(청동 정·징 틀·무기 걸이·서가·약재장·상자·화로…)가
 * 하네스 관문(작업자가 선언한 윗면 행만 보는 F)과 LLM 검수자를 모두 통과했다. 사용자: 「에디터든 어느 하네싱이든
 * 오브젝트를 생성하면 검증 게이트를 거치게끔 해야 하는데 전혀 안 되어 있구나」.
 * 그래서 판정은 ① 작업자 선언을 받지 않고 ② 판정자에게 숫자(윗면 행 수·아가리)를 재게 해 규칙으로 계산하고
 * ③ 판정자 둘 × 여러 번이 만장일치일 때만 통과로 하며 ④ 위반 표본을 하나도 통과시키지 않는 프로필만 쓴다(보정).
 * 계약 원문: tiledata/atlas-pick/modern-style-bible.md §10·§11, 문서 openwiki/harnesses/object-gate.md.
 *
 * 2026-10-14(규칙 v4): 판정 한 번이 두 가지를 같이 정한다 — (a) 3/4 시점, (b) 버들항 수준 화풍(같은 종류 버들항 조각과 같은 배율로 견줘
 * 명암 단계·윤곽 색·질감·칸 정보량을 읽는다). 영수증은 두 판정을 따로 적고 둘 다 통과해야 통과다. 판정자는 Claude Sonnet 5.5 high(2026-10-14 사용자 결정, 이전 gemini-4-argon).
 * 숫자 지표(칸당 색 수 등)는 영수증에 보조로만 남고 통과 근거가 아니다. 테마마다 잠긴 팔레트는 그대로 — 구조와 명암만 본다.
 */

export const OBJECT_GATE_RULES_VERSION = 5;

export type ObjectGateKind =
  | "tall_furniture" | "low_furniture" | "seat" | "frame" | "container" | "round_body" | "column" | "box"
  | "structure" | "figure" | "organic" | "debris" | "flat" | "wall_mounted" | "terrain" | "other";

/** 종류 → 판정자에게 주는 뜻 · 윗면 최소 행 수(없으면 윗면 행 수로 떨어뜨리지 않는다). */
/**
 * exempt = 시점 규칙을 재지 않는 종류(실내 기준 RUBRIC 의 EXEMPT·깔개·벽 부착물). 판정자 과반이 「종류가 맞다」고 해야 한다 —
 * 진열장을 organic 이라 불러 빠져나가는 것을 막는다.
 */
export const OBJECT_GATE_KINDS: Record<ObjectGateKind, { meaning: string; minTopRows?: number; minOpeningRows?: number; exempt?: boolean }> = {
  // 2026-10-14: 윗면 하한을 3/4 계약(modern-style-bible §11-1: 4~6px, 새 그림은 5~6)의 아래 끝 4 로 맞췄다 — 세 줄짜리는 계약 미달이었다.
  tall_furniture: { meaning: "tall furniture standing against a wall: bookshelf, cabinet, wardrobe, drawer chest, cupboard, fireplace", minTopRows: 4 },
  low_furniture: { meaning: "low furniture: table, desk, tea table, bed, counter, bench top", minTopRows: 3 },
  seat: { meaning: "seat: stool, chair, cushion seat (the seat surface must be seen from above)", minTopRows: 4 },
  frame: { meaning: "open frame or rack: weapon rack, gong/bell frame, target stand, sandbag frame, cell bars, well pulley frame (its horizontal beams and base must show top faces)", minTopRows: 3 },
  container: { meaning: "container with an opening: pot, jar, cauldron/ding, well, brazier, censer, open coffin (the inside of the opening must be seen from above)", minOpeningRows: 4 },
  round_body: { meaning: "closed cylinder: drum, barrel, round stool (the top cap is an ellipse seen from above)", minTopRows: 4 },
  column: { meaning: "column-like: pillar, stone lantern, stele, pole, broken pillar (the top end must show its top surface / cut face)", minTopRows: 3 },
  box: { meaning: "box-like: chest, crate, closed coffin, altar block, stacked crates (the lid/top must be seen from above)", minTopRows: 4 },
  structure: { meaning: "large structure: gate, pavilion, sealed door, building (roofs and lintels must show their top slopes/surfaces)", minTopRows: 3 },
  figure: { meaning: "statue or figure (its base/plinth must show a top surface)", minTopRows: 3 },
  organic: { meaning: "organic: plants, bamboo, trees, rocks, mushrooms, crystals, roots, firewood", exempt: true },
  debris: { meaning: "scattered debris lying on the floor: bones, rubble, broken pots/shards, scattered papers", exempt: true },
  flat: { meaning: "lies flat on the ground: mat, rug, magic circle, pressure plate, floor decal (seen from above as a plate)", exempt: true },
  wall_mounted: { meaning: "mounted flat on a wall: wall torch, cobweb, chains, plaque, picture (may be flat)", exempt: true },
  terrain: { meaning: "terrain tiles, not a standing object: ground, floor, wall face, roof surface, water, cliff, autotile block", exempt: true },
  other: { meaning: "other standing object", minTopRows: 3 },
};

export const OBJECT_GATE_RUBRIC = `You audit 16px pixel-art map objects for a top-down JRPG drawn in the "3/4 view" (RPG Maker style).
PART A — the 3/4 view contract.
The camera is south of the object looking down at about 45 degrees, so every standing object shows its TOP surface (horizontal surfaces seen from above, foreshortened) AND its FRONT (south) face. No receding isometric side faces.
Note: an object that faces east/west shows its own side silhouette as its south face (e.g. an L-shaped chair profile) — that is normal. What fails is a horizontal surface (seat, table top, lid, opening, beam top, cap, base) that is NOT visible from above.
Four drawings FAIL even though they look tidy:
 - FRONT ELEVATION: the object is drawn straight from the front like an architectural elevation; only a 0-2px line (or a band the same tone as the front) marks where the top should be. Doors, drawer fronts, shelves, cushions seen face-on, panels and windows are VERTICAL faces however large, light or detailed.
 - SIDE ELEVATION: a profile silhouette (a chair seen from the side whose seat is only an edge, a cradle or bench seen end-on, a spiral staircase seen as a side cut) with no horizontal surface visible from above.
 - TOP-DOWN PLAN: only the lid / top is drawn (a coffin lid, a bed seen as a flat plank, a rug-like slab) and the front face below it is missing.
 - RIM ONLY: the "top" is a 1-2 row rim, cap line, edge highlight or lip that is too thin to read as a surface (columns, barrels, safes, fish tanks and stoves usually fail this way).
Image 1 is magnified 10x; the numbers on the left are source pixel row indices (every 2 rows); the faint grid is 1 source pixel. Image 2 shows the candidate again, clean, to the right of the magenta bar, next to Beodeul reference pieces that are correct 3/4 pieces by construction: look at how the stall roof, the well rim and the cart bed read as lighter horizontal bands sitting above their front faces. Image 3 is a fixed GUIDE of synthetic shapes (green frame = correct 3/4 drawing, red frame = wrong drawing: front elevation, rim only, flat-band column cap, thin seat, thin barrel lid, top-down slab, side elevation chair). Classify the candidate by comparing its structure with the guide, not by its subject or detail.
Judge the MAIN BODY of the object (the largest volume), not small details like handles, ornaments, incense sticks or a base plinth. Do not give credit for a top visible only on a small part.
Measure strictly in source pixels, in this order:
1. projection: classify the whole drawing as "three_quarter" (a top band AND a front face are both clearly drawn), "front_elevation", "side_elevation", "top_down" or "other".
2. Read ONE vertical pixel column through the middle of the main body from its highest opaque row downward. In a correct 3/4 object you meet: a TOP band (a horizontal surface, normally the lightest tone because it faces the light, several consecutive rows of similar colour), then a step (a front-edge highlight or an abrupt tone change), then the FRONT face (a vertical surface with its own shading and details). Write what you see in "top_band" (colour and row range, or "none").
3. top_rows: how many pixel rows tall is that top band only (from its back edge to its front edge). A 1-2px rim, cap line or edge highlight is NOT a top surface. A top band is foreshortened, so it is much shorter than the object is tall; if you counted a region that looks like the object's face (a cushion, backrest, door, panel, lid slab that fills the object) you counted a vertical face — recount.
4. front_face_rows: how many pixel rows tall is the vertical south face (or the legs/supports of an open piece) directly below the top band. 0 for a top-down plan.
4b. Three construction checks taken from the 3/4 contract (answer each from the single pixel column you read in step 2; "true" only if you can point at the rows):
   - front_edge_line: a distinct 1-row line (lighter than the top or a different tone) marks the FRONT EDGE where the top ends and the front face begins.
   - eave_shadow: 1-2 rows of darker tone directly under that edge (the top overhangs and shades the face), or for an open piece the front face is visibly set back under the top.
   - recessed_front: doors, drawers, shelves, windows or openings on the front face are drawn INSET (a dark inner edge on top/left, an inner shadow) rather than painted flat on the surface.
   A flat front face with none of the three and only a band of lighter colour on top is a front elevation with a hat, not a 3/4 object.
5. opening_visible (containers only, else null): the inside of the opening is shown as an ellipse (you can see into it or its interior surface). A single dark line across the rim is NOT an opening.
6. opening_rows (containers only, else null): how many pixel rows tall is the visible inside of the opening, between the back rim and the front rim (rims excluded).
7. side_face_visible: an isometric receding side face is drawn (not the normal south face).
8. pure_front_elevation: the main body is drawn as a flat front view.
9. kind_matches: the caller-supplied kind plausibly describes this object (false if e.g. a cabinet is labelled organic or flat).
10. Use the EXACT COLUMN SCAN that comes with the question for every number in steps 2-6. It lists, for three vertical columns, the runs of rows with similar lightness L (0-255). An OUTLINE row is a 1-row dark run (L below about 80) at the silhouette edge; it is not part of the top band. The TOP band is the run(s) directly under the outline (or under the topmost props standing on it) that read as one lighter horizontal surface: it must be separated from the front face below by a step of at least about 25 L or by a distinct 1-row edge line. A run that stays in the same lightness family as the front face below (difference under about 25 L) belongs to the front face, so it is NOT a top and top_rows excludes it. Count top_rows and opening_rows from the scan, never from a rough look at the picture.
11. MIXED DRAWINGS: if the picture contains several distinct parts or objects (a lectern plus a staircase, a counter plus shelves, a seat plus a backrest panel), EVERY major part must satisfy the contract. If one major part is drawn in side or front elevation, the whole drawing fails even when another part is a correct 3/4 piece; say which part is wrong in "evidence".
11b. ELLIPSE TOPS (seats, containers, basins, pots, round tables — NOT columns, pillars, stelae or rune stones, which follow rule 12): when the top is a rounded/elliptical surface (seat cushion, stool seat, barrel or pot mouth, basin, round table, water or coal surface inside a container), measure the WHOLE ellipse silhouette from its back rim row to its front rim row INCLUSIVE — the light surface rows plus the darker lip/rim row that closes the ellipse at the front belong to the top (a seat with light rows 2-4 and a darker front-rim row 5 is a 4-row top). For flat rectangular tops (cabinet, shelf, table) keep counting only the lighter horizontal band, not the front-edge line or the shadow row. For containers, a heap of contents (coal, grain, water, herbs) whose surface rises above the front rim counts as the visible inside: opening_visible is true when you can see that surface from above, and opening_rows is the height of that surface plus the rim rows around it. For open pieces (stools, racks, tables on legs) front_face_rows counts the rows of legs, stem, apron or front lip below the top.
12. CAPS: for columns, pillars, stelae, rune stones and lantern posts count ONLY the clearly lighter top-face rows (never the darker lip, rim or shadow rows under them), and the top must be a visible top face — an ellipse or a plate whose silhouette corners are rounded or wider than the shaft, at least 4 rows tall, clearly lighter than the shaft. A straight rectangular light band of 1-3 rows, or a "cap band over a dark underside" that is no wider than the body, is the red "flat band cap" of the guide and fails.
Be strict: when in doubt, fail.`;

/** 화풍 종류 — 같은 종류의 버들항 기준 그림을 비교 대상으로 준다(지붕은 지붕끼리, 나무는 나무끼리). */
export type ObjectGateStyleKind = "building" | "roof" | "wall" | "tree" | "ground" | "water" | "prop";

export const OBJECT_GATE_STYLE_KINDS: Record<ObjectGateStyleKind, string> = {
  building: "a whole building (roof + walls + door/windows)",
  roof: "a roof surface (tiles, thatch, slate, sheet metal)",
  wall: "a wall face (plaster, timber frame, brick, stone, panels)",
  tree: "a tree, bush or other plant (canopy, trunk)",
  ground: "a ground surface patch (grass, soil, sand, paving, floor) laid 4x3 tiles",
  water: "a water surface patch",
  prop: "a standing prop or furniture piece (cart, stall, well, lamp, crate, furniture)",
};

/** 3/4 종류 → 화풍 종류 기본값. 호출하는 쪽이 styleKind 를 주면 그것이 이긴다(지붕·벽 조각은 terrain 이라 ground 로 떨어지니 직접 준다). */
export const defaultObjectGateStyleKind = (kind: ObjectGateKind): ObjectGateStyleKind =>
  kind === "structure" ? "building" : kind === "organic" ? "tree" : kind === "terrain" || kind === "flat" ? "ground" : "prop";

export const OBJECT_GATE_STYLE_RUBRIC = `PART B — ART STYLE against the Beodeul standard (the quality bar for every themed chipset).
After the magnified image you get a COMPARISON BOARD: on the left, one or two REFERENCE pieces of the SAME KIND taken from the Beodeul chipset; on the right (after the magenta divider) the CANDIDATE, drawn at exactly the same scale, without a grid. Compare them side by side.
Each theme keeps its own locked palette. NEVER judge hue, never ask for Beodeul's colours, never fail a piece for being dark, pale, cold or saturated. Judge only structure and shading craft:
1. Shading steps: count the distinct lightness steps on the candidate's main material ramps (e.g. a tile roof: highlight, light, mid, dark, deep; a leaf canopy: 4-5 greens). Beodeul uses about 5-6 steps per material. 2-3 steps (a flat body, one shade and an outline) is shallow.
2. Outline: Beodeul outlines are the DARK TONE OF THE ADJACENT MATERIAL (dark brown next to wood, dark green next to leaves, dark red-brown next to roof tiles), used selectively; forms are often separated by value alone. A uniform near-black / pure black line around every shape is the shallow "sticker" look. Decide by TINT: if the outline pixels are almost colourless (neutral black or very dark grey, no visible brown/green/red/blue lean) it is "near_black"; if they are a dark but visibly tinted version of the neighbouring material (dark brown beside wood, dark green beside leaves, dark red-brown beside roof tiles) it is "dark_material_tone", however dark. Report "dark_material_tone", "near_black", "mixed" or "none".
3. Texture: Beodeul surfaces carry texture dots and grain — roof tile scallops with per-tile highlights, plaster speckle, leaf clumps in several greens, stones shaded one by one, grass tufts and soil grain. Large areas (about 5x5 source pixels or more) of ONE flat colour with no dot, grain or variation are flat fills.
4. Tile information density: compare how much each 16x16 tile of the candidate carries against a reference tile of the same kind. Beodeul tiles are information-rich (median about 10 distinct colours per tile, the richest tiles 40+). Tiles that are mostly 2-4 colours are much lower.
5. MEASURED STYLE FACTS are given with the question for the candidate and for each reference, computed exactly from the pixels: median distinct colours per full 16x16 tile (0 = the piece is smaller than one tile, then judge by eye), 5x5 flat-fill coverage (share of pixels inside some 5x5 block of one identical colour), the near-neutral share of dark edge pixels (bottom edge row excluded; colour spread 12 or less: 100% means a neutral black/grey outline line, 0% means the outline carries a colour tint), and the number of distinct colours. Use them as evidence next to the picture: a candidate that is far below every reference in colours per tile and distinct colours, or far above them in flat-fill coverage, or whose dark edge pixels are mostly neutral, is shallow; a candidate at or above the references on these facts, with tinted outlines, is not. The facts never replace your eye on structure, but you must not call something "rich" or "dark_material_tone" against the numbers without saying why.
Compare against the reference of the same kind at the same scale. Do not fail a piece only because it is small or simple, and do not pass it only because it is cleanly drawn: pass only if a careful artist would accept it next to the reference without it looking thinner, flatter or more "sticker-like". A piece that is plainly the reference itself or equally rich passes. When in doubt, fail.
"score" is an auxiliary 1-10 rating (reference = 8-9); it never decides anything.`;

export const OBJECT_GATE_OUTPUT_FORMAT = `Reply ONLY JSON:
{"main_body": string, "projection": "three_quarter"|"front_elevation"|"side_elevation"|"top_down"|"other", "top_band": string, "kind_matches": bool, "top_rows": int, "front_face_rows": int, "front_edge_line": bool, "eave_shadow": bool, "recessed_front": bool, "opening_visible": bool|null, "opening_rows": int|null, "side_face_visible": bool, "pure_front_elevation": bool, "evidence": string, "verdict": "pass"|"fail",
 "style": {"ref_kind_matches": bool, "shading_steps": int, "reference_steps": int, "outline": "dark_material_tone"|"near_black"|"mixed"|"none", "texture": "rich"|"some"|"flat", "flat_fills": bool, "density": "equal_or_richer"|"slightly_lower"|"much_lower", "score": int, "evidence": string, "verdict": "pass"|"fail"}}
"evidence"/"verdict" at the top level are PART A (3/4 view). Everything about PART B goes inside "style".`;

export type ObjectGateStyleAnswer = {
  ref_kind_matches?: boolean; shading_steps?: number; reference_steps?: number;
  outline?: "dark_material_tone" | "near_black" | "mixed" | "none" | string; texture?: "rich" | "some" | "flat" | string; flat_fills?: boolean;
  density?: "equal_or_richer" | "slightly_lower" | "much_lower" | string; score?: number; evidence?: string; verdict?: string;
};

export type ObjectGateJudgeAnswer = {
  main_body?: string; projection?: string; top_band?: string; front_face_rows?: number; front_edge_line?: boolean; eave_shadow?: boolean; recessed_front?: boolean; kind_matches?: boolean; top_rows?: number; opening_visible?: boolean | null; opening_rows?: number | null;
  side_face_visible?: boolean; pure_front_elevation?: boolean; evidence?: string; verdict?: string;
  style?: ObjectGateStyleAnswer | null;
};

export type ObjectGateDecision = { pass: boolean; reasons: string[] };
export type ObjectGateBothDecision = { pass: boolean; view34: ObjectGateDecision; style: ObjectGateDecision; reasons: string[] };

/** 판정자 한 번의 답을 규칙으로 계산한다(보고용). 판정자가 pass 라 해도 숫자가 기준에 못 미치면 fail. */
export function decideObjectGateRun(kind: ObjectGateKind, answer: ObjectGateJudgeAnswer | null, styleKind: ObjectGateStyleKind = defaultObjectGateStyleKind(kind)): ObjectGateBothDecision {
  if (!answer) { const none = { pass: false, reasons: ["판정자 답을 읽지 못함"] }; return { pass: false, view34: none, style: none, reasons: ["3/4: 판정자 답을 읽지 못함", "화풍: 판정자 답을 읽지 못함"] }; }
  return decideObjectGateBoth(kind, styleKind, [answer]);
}

const median = (values: number[]) => {
  if (!values.length) return -1;
  const sorted = [...values].sort((a, b) => a - b), mid = sorted.length / 2;
  return sorted.length % 2 ? sorted[Math.floor(mid)]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/**
 * 여러 판정(판정자 × 반복)을 합친다. 숫자는 중앙값, 예/아니오는 과반(절반 넘게)이 그렇다고 할 때만 센다.
 * 만장일치(v1)는 한 판정자의 우연한 오독이 정상 기물을 떨어뜨렸다(보정 2026-10-09: 정상 10/28).
 * 답을 못 읽은 판정은 불합격 표로 센다 — 판정자가 죽으면 통과가 아니라 막힌다.
 */
export function decideObjectGate(kind: ObjectGateKind, answers: Array<ObjectGateJudgeAnswer | null>): ObjectGateDecision {
  const rule = OBJECT_GATE_KINDS[kind] ?? OBJECT_GATE_KINDS.other;
  const total = answers.length;
  if (!total) return { pass: false, reasons: ["판정 없음"] };
  const read = answers.filter((a): a is ObjectGateJudgeAnswer => !!a);
  const majority = (flag: (a: ObjectGateJudgeAnswer) => boolean) => read.filter(flag).length + (total - read.length) > total / 2;
  const reasons: string[] = [];
  if (total - read.length > total / 2) reasons.push("판정자 답을 읽지 못함");
  if (majority(a => a.kind_matches === false)) reasons.push("종류 불일치");
  if (!rule.exempt) {
    if (majority(a => a.verdict !== "pass")) reasons.push("판정자 과반 fail");
    if (majority(a => a.pure_front_elevation === true)) reasons.push("정면 입면도");
    const bad = (["front_elevation", "side_elevation", "top_down"] as const).find(v => majority(a => a.projection === v));
    if (bad) reasons.push(`투영이 3/4 아님(${bad})`);
    const front = median(read.map(a => (typeof a.front_face_rows === "number" ? a.front_face_rows : 0)));
    if (front < OBJECT_GATE_MIN_FRONT_ROWS) reasons.push(`앞면 ${front}행 < ${OBJECT_GATE_MIN_FRONT_ROWS}`);
    if (majority(a => a.side_face_visible === true)) reasons.push("옆면(아이소)");
    if (rule.minTopRows !== undefined) {
      const top = median(read.map(a => (typeof a.top_rows === "number" ? a.top_rows : 0)));
      if (top < rule.minTopRows) reasons.push(`윗면 ${top}행 < ${rule.minTopRows}`);
    }
    if (rule.minOpeningRows !== undefined) {
      if (majority(a => a.opening_visible !== true)) reasons.push("아가리 안쪽이 안 보임");
      const open = median(read.map(a => (a.opening_visible === true && typeof a.opening_rows === "number" ? a.opening_rows : 0)));
      if (open < rule.minOpeningRows) reasons.push(`아가리 ${open}행 < ${rule.minOpeningRows}`);
    }
  }
  return { pass: reasons.length === 0, reasons };
}

/** 화풍 판정 — 숫자 답은 중앙값, 예/아니오·범주는 절반 이상(동률 포함). 통과는 판정자 과반 pass 이면서 아래 걸림이 하나도 없을 때만이다(걸림은 통과를 더 막기만 한다). */
export function decideObjectGateStyle(answers: Array<ObjectGateJudgeAnswer | null>): ObjectGateDecision {
  const total = answers.length;
  if (!total) return { pass: false, reasons: ["판정 없음"] };
  const read = answers.filter((a): a is ObjectGateJudgeAnswer => !!a);
  const styles = read.map(a => a.style ?? null);
  const absent = total - styles.filter(Boolean).length; // 못 읽었거나 style 이 없는 판정은 불합격 표
  // 화풍은 「의심스러우면 불합격」 — 동률(4표 중 2표)도 걸린 것으로 센다.
  const majority = (flag: (s: ObjectGateStyleAnswer) => boolean) => styles.filter((s): s is ObjectGateStyleAnswer => !!s && flag(s)).length + absent >= total / 2;
  const reasons: string[] = [];
  if (absent >= total / 2) reasons.push("화풍 답을 읽지 못함");
  if (majority(s => s.verdict !== "pass")) reasons.push("판정자 과반 fail");
  if (majority(s => s.outline === "near_black")) reasons.push("윤곽이 근흑(재질 어두운 톤 아님)");
  if (majority(s => s.flat_fills === true)) reasons.push("평면 채움");
  if (majority(s => s.texture === "flat")) reasons.push("질감 없음");
  if (majority(s => s.density === "much_lower")) reasons.push("칸 정보량이 기준보다 훨씬 낮음");
  const steps = median(styles.filter(Boolean).map(s => (typeof s!.shading_steps === "number" ? s!.shading_steps : 0)));
  if (steps < OBJECT_GATE_STYLE_MIN_STEPS) reasons.push(`명암 ${steps}단 < ${OBJECT_GATE_STYLE_MIN_STEPS}`);
  return { pass: reasons.length === 0, reasons };
}

/** 명암 단계 하한. 버들항은 재질마다 5~6단이다. 작은 조각이 한 재질에 4단도 못 쓰면 얕다. */
export const OBJECT_GATE_STYLE_MIN_STEPS = 4;
/** 앞면(남쪽 세로 면 또는 열린 기물의 다리·받침) 하한 행 수. 윗면만 있는 평면도(관 뚜껑·바닥에 누운 침대)를 막는다. */
export const OBJECT_GATE_MIN_FRONT_ROWS = 3;

/** 한 판정 묶음에서 3/4 와 화풍을 따로 계산한다. 통과는 둘 다 통과여야 한다. */
export function decideObjectGateBoth(kind: ObjectGateKind, _styleKind: ObjectGateStyleKind, answers: Array<ObjectGateJudgeAnswer | null>): ObjectGateBothDecision {
  const view34 = decideObjectGate(kind, answers), style = decideObjectGateStyle(answers);
  return { pass: view34.pass && style.pass, view34, style, reasons: [...view34.reasons.map(r => `3/4: ${r}`), ...style.reasons.map(r => `화풍: ${r}`)] };
}

/** 판정 프로필 — 이 값이 바뀌면 프로필 해시가 바뀌고, 새 프로필은 보정을 다시 통과해야 쓸 수 있다. */
export const OBJECT_GATE_PROFILE = {
  rulesVersion: OBJECT_GATE_RULES_VERSION,
  factsVersion: 1, // node/facts.ts — 판정자에게 주는 정확한 열 훑기·화풍 측정(알고리즘을 바꾸면 올린다)
  rubric: OBJECT_GATE_RUBRIC,
  styleRubric: OBJECT_GATE_STYLE_RUBRIC,
  outputFormat: OBJECT_GATE_OUTPUT_FORMAT,
  styleKinds: OBJECT_GATE_STYLE_KINDS,
  styleMinSteps: OBJECT_GATE_STYLE_MIN_STEPS,
  minFrontRows: OBJECT_GATE_MIN_FRONT_ROWS,
  kinds: OBJECT_GATE_KINDS,
  // 2026-10-14: 사용자 결정 「argon 뻗었어 — 그냥 argon 이 하던 거 sonnet 5.5 high 가 하게 해라」. 판정자는 Claude Sonnet 5.5 high 하나(claude -p 헤드리스, 그림 첨부) × 4번.
  // 판정자 신원(provider·model·effort)은 프로필 해시에 들어가고 `status` 가 보여 준다. 다른 모델로 몰래 넘어가지 않는다 — Sonnet 이 안 되면 멈춘다.
  judges: [
    { id: "sonnet", provider: "claude-cli", model: "claude-sonnet-5-5", effort: "high" },
  ],
  runsPerJudge: 4,
  magnify: 10,
  combine: "median-majority" as const,
};

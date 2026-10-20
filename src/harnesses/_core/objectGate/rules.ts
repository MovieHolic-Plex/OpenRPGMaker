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
 *
 * 2026-10-15(규칙 v6, 작업자 G): ① 판정자는 「사실만」 서술한다(부분별 윗면 행·앞 가장자리선·처마 그림자·실루엣 폭·종류에 맞는 캡 모양) — 통과·불합격을 판정자가 정하지 않고 규칙이 계산한다.
 * ② 3/4 와 화풍은 **따로 호출**한다(서로의 약점이 번지지 않게). ③ 결과는 3상태: pass · fail · **refer(사람 확인 필요 — 판정자 의견이 갈리거나 사용자 정의 영역)**. refer 는 pass 로 세지 않으며 모든 출구에서 막힌다.
 * ④ 보정은 확실 라벨(A)만 통과·차단 기준으로 세고, 다툼(C)·사용자 수락(U)은 따로 보고한다. 라벨은 숫자에 맞춰 바꾸지 않는다. 숨김 표본(hidden)은 규칙을 조정한 뒤 처음 재는 표본이다.
 */

export const OBJECT_GATE_RULES_VERSION = 10;

export type ObjectGateKind =
  | "tall_furniture" | "low_furniture" | "seat" | "frame" | "container" | "round_body" | "column" | "box"
  | "structure" | "figure" | "organic" | "debris" | "flat" | "wall_mounted" | "front_prop" | "terrain" | "other" | "wall_structure";

/** 종류 → 판정자에게 주는 뜻 · 윗면 최소 행 수(없으면 윗면 행 수로 떨어뜨리지 않는다). */
/**
 * exempt = 시점 규칙을 재지 않는 종류(실내 기준 RUBRIC 의 EXEMPT·깔개·벽 부착물). 판정자 과반이 「종류가 맞다」고 해야 한다 —
 * 진열장을 organic 이라 불러 빠져나가는 것을 막는다.
 */
export const OBJECT_GATE_KINDS: Record<ObjectGateKind, { meaning: string; minTopRows?: number; minOpeningRows?: number; minFrontRows?: number; exempt?: boolean; humanOnly?: boolean }> = {
  // 2026-10-14: 윗면 하한을 3/4 계약(modern-style-bible §11-1: 4~6px, 새 그림은 5~6)의 아래 끝 4 로 맞췄다 — 세 줄짜리는 계약 미달이었다.
  tall_furniture: { meaning: "tall furniture standing against a wall: bookshelf, cabinet, wardrobe, drawer chest, cupboard, fireplace", minTopRows: 4 },
  low_furniture: { meaning: "low furniture: table, desk, tea table, bed, counter, bench top", minTopRows: 3 },
  seat: { meaning: "seat: stool, chair, bench, sofa, pew, cushion seat (the SEAT surface where one sits must be seen from above; its backrest and armrests are exempt from the top-surface rule)", minTopRows: 4 },
  frame: { meaning: "open frame or rack: weapon rack, gong/bell frame, target stand, sandbag frame, cell bars, well pulley frame (its horizontal beams and base must show top faces)", minTopRows: 3 },
  container: { meaning: "container with an opening: pot, jar, cauldron/ding, well, brazier, censer, open coffin (the inside of the opening must be seen from above)", minOpeningRows: 4 },
  round_body: { meaning: "closed cylinder: drum, barrel, round stool (the top cap is an ellipse seen from above)", minTopRows: 4 },
  column: { meaning: "column-like: pillar, stone lantern, stele, pole, broken pillar (the top end must show an elliptical cap plate that overhangs the shaft)", minTopRows: 4 },
  box: { meaning: "box-like: chest, crate, closed coffin, altar block, stacked crates (the lid/top must be seen from above)", minTopRows: 4, minFrontRows: 8 },
  structure: { meaning: "large structure: gate, pavilion, sealed door, building (roofs and lintels must show their top slopes/surfaces)", minTopRows: 3 },
  figure: { meaning: "statue or figure (its base/plinth must show a top surface)", minTopRows: 3 },
  organic: { meaning: "organic: plants, bamboo, trees, rocks, mushrooms, crystals, roots, firewood", exempt: true },
  debris: { meaning: "scattered debris lying on the floor: bones, rubble, broken pots/shards, scattered papers", exempt: true },
  flat: { meaning: "lies flat on the ground: mat, rug, magic circle, pressure plate, floor decal (seen from above as a plate)", exempt: true },
  wall_mounted: { meaning: "mounted flat on a wall: wall torch, cobweb, chains, plaque, picture (may be flat)", exempt: true },
  front_prop: { meaning: "front-facing sign or drying frame: a free-standing sandwich board / A-frame sign or post sign, a laundry or cloth drying rack, a fishing-net drying frame, a hanging-banner stand — its whole design is one flat front panel on legs or a frame, so no top surface is expected. It is NOT any storage or display furniture (weapon/spear/saddle/keg rack, shelf, bookshelf, cabinet, wardrobe, chest, drawers, table, seat), NOT a gong/bell frame, NOT a container or barrel, NOT a building, door or gate. If the object holds goods or has a body with volume that ought to show a top, this kind does NOT match", exempt: true, humanOnly: true },
  terrain: { meaning: "terrain tiles, not a standing object: ground, floor, wall face, roof surface, water, cliff, autotile block", exempt: true },
  other: { meaning: "other standing object", minTopRows: 3 },
  // v9 최종 판정(2026-10-21): 벽에 붙은 구조물. 면제 종류가 아니다 — 벽에서 튀어나온 부분은 윗면을 보인다.
  wall_structure: { meaning: "built-in wall piece: a wall opening (serving hatch, window, pass-through), a wall-hung shelf, a post or pillar engaged in a wall, wainscot, a beam. Every part that sticks out from the wall (sill, ledge, shelf board, counter, cap, beam) shows its top face seen from above", minTopRows: 2 },
};

export const OBJECT_GATE_RUBRIC = `You are a measuring instrument for 16px pixel-art map objects drawn for a top-down JRPG in "3/4 view". You report what is drawn, as JSON. You do NOT decide pass or fail; a separate rule does.
VIEW CONTRACT: the camera is south of the object looking down about 45 degrees. A standing object shows its TOP surfaces (horizontal surfaces seen from above, foreshortened) AND its FRONT (south) face. An object that faces east or west shows its own side profile as its south face; that is normal and is judged with the same rules below.
EVIDENCE OF A TOP SURFACE (any one is enough, and you must point at rows):
 (a) a band of rows at the top of a part that ends in a FRONT-EDGE LINE (a 1-row line lighter or darker than its neighbours), usually followed by 1-2 rows of darker EAVE SHADOW, with the front face below. The band does NOT have to be lighter than the face below.
 (b) an ELLIPSE: a lid, seat, cap, bowl mouth or tub opening whose silhouette widens and then narrows again (use the width profile). Count it from its back rim row to its front rim row inclusive.
 (c) a sloped ROOF, AWNING or CANOPY plane above an eave or edge line on a building or stall (its tile or stripe rows ARE the top surface).
 (d) contents, water or a heap visible inside an open container.
NOT A TOP SURFACE: the 1-row outline at the silhouette; a 1-2 row rim or lip; a vertical face (door, drawer front, panel, window, a backrest or cushion seen face-on); a cornice or beam drawn as a front-facing strip with no edge line and no shadow; a dome-shaped top end that is rounded only at its upper edge and has a flat bottom edge directly on a narrower shaft (a "hat" or rounded end is not an ellipse cap).
DECOR PARTS (rules v9): things that stand on, grow out of or rise above the main body but are not part of its built structure — a tree canopy or plant in a planter, pot or flowerbox; the figure of a statue standing on its plinth; a water jet or spout over a basin; goods, screens, monitors, ornaments or a sign placed on a counter, table or shelf top; a flag on a pole. List them in "surfaces" with evidence "decor": they are not expected to show a top surface, and they are NOT the main body. Measure the main body that carries them (the planter mouth, the plinth top, the counter top) as usual. NEVER call a part of the object's own structure decor: a backrest, headboard, cabinet or shelf body, hood, canopy frame, awning, roof, chimney, engine or machine housing, a stacked second crate, a door or panel are structure.
SEAT PARTS (rules v10, user decision 2026-10-20) — ONLY when the caller-supplied kind is seat (chair, sofa, bench, pew, stool with a back): the BACKREST and the ARMRESTS are exempt from the top-surface rule. They may be drawn as vertical faces. List each of them in "surfaces" with evidence "seat_back". The MAIN BODY of a seat is its SEAT surface (where one sits): measure "main_top_rows" on the seat surface, not on the backrest, and decide "reads_as" from the seat surface and the front face below it. A seat whose sitting surface shows no top (only a front band, or a 1-3 row strip) is still front_elevation. For every other kind there is no such exemption and "seat_back" must not be used.
FRONT FACE: the vertical south face (or the legs, apron or supports of an open piece). A drawing with no front face (fewer than 3 rows) is a flat top-down slab.
Measure the MAIN BODY (the largest volume), not small details. Use the EXACT COLUMN SCAN and the SILHOUETTE WIDTH profile given with the question for every row number; row numbers equal the source-pixel rows on the left ruler of image 1.
Image 1 is the candidate magnified 10x with the source row numbers on the left. Image 2 shows REAL reference pairs of the same objects (red frame = WRONG drawing, green frame = RIGHT drawing). Image 3 is a fixed GUIDE of synthetic shapes (green = right, red = wrong). Compare the structure of the candidate with them; do not judge by subject or detail.`;

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

export const OBJECT_GATE_STYLE_RUBRIC = `ART STYLE against the Beodeul standard (the quality bar for every themed chipset).
You get a COMPARISON BOARD (image 1): on the left, one or two REFERENCE pieces of the SAME KIND taken from the Beodeul chipset; on the right (after the magenta divider) the CANDIDATE, drawn at exactly the same scale, without a grid. Compare them side by side.
Each theme keeps its own locked palette. NEVER judge hue, never ask for Beodeul's colours, never fail a piece for being dark, pale, cold or saturated. Judge only structure and shading craft:
1. Shading steps: count the distinct lightness steps on the candidate's main material ramps (e.g. a tile roof: highlight, light, mid, dark, deep; a leaf canopy: 4-5 greens). Beodeul uses about 5-6 steps per material. 2-3 steps (a flat body, one shade and an outline) is shallow.
2. Outline: Beodeul outlines are the DARK TONE OF THE ADJACENT MATERIAL (dark brown next to wood, dark green next to leaves, dark red-brown next to roof tiles), used selectively; forms are often separated by value alone. A uniform near-black / pure black line around every shape is the shallow "sticker" look. Decide by TINT: if the outline pixels are almost colourless (neutral black or very dark grey, no visible brown/green/red/blue lean) it is "near_black"; if they are a dark but visibly tinted version of the neighbouring material (dark brown beside wood, dark green beside leaves, dark red-brown beside roof tiles) it is "dark_material_tone", however dark. Report "dark_material_tone", "near_black", "mixed" or "none".
3. Texture: Beodeul surfaces carry texture dots and grain — roof tile scallops with per-tile highlights, plaster speckle, leaf clumps in several greens, stones shaded one by one, grass tufts and soil grain. Large areas (about 5x5 source pixels or more) of ONE flat colour with no dot, grain or variation are flat fills.
4. Tile information density: compare how much VISIBLE information each 16x16 tile of the candidate carries against a reference tile of the same kind — distinct tones the eye can tell apart, shapes, clusters, grain. Count tones, not raw colours: Beodeul references often contain dozens of near-identical shades (a grass tile with 26 raw greens shows about 3 visible tones; a tree tile with 100+ raw colours shows about 20-30), and a candidate drawn with a locked palette uses fewer raw colours for the same visible texture. Tiles that show only 2-4 visible tones are much lower.
5. MEASURED STYLE FACTS are given with the question for the candidate and for each reference, computed exactly from the pixels. Primary: VISIBLE tones per full 16x16 tile (colours merged to 16 levels per channel; 0 = the piece is smaller than one tile, then judge by eye), near-flat coverage (share of pixels inside some 5x5 block with no visible change), and the near-neutral share of dark edge pixels (bottom edge row excluded; colour spread 12 or less: 100% means a neutral black/grey outline line, 0% means the outline carries a colour tint). Raw counts (exact distinct colours per tile, exact 5x5 flat fill, total distinct colours) are listed too but are inflated by invisible near-identical shades — never call a candidate "much_lower" from raw colour counts alone. Use the primary facts as evidence next to the picture: a candidate far below every reference in visible tones per tile, or far above them in near-flat coverage, or whose dark edge pixels are mostly neutral, is shallow; a candidate at or above the references on the primary facts, with tinted outlines, is not. The facts never replace your eye on structure, but you must not call something "rich" or "dark_material_tone" against the numbers without saying why.
Compare against the reference of the same kind at the same scale. Do not fail a piece only because it is small or simple. For THIN or SPARSE objects (poles, lamps, fences, rails, single-tile props) the per-tile colour median may be 0 or tiny because few pixels fill a whole tile: then do not use the density fact against the piece; judge density by eye against the reference of the same kind, and never fail a piece for sparseness alone, and do not pass it only because it is cleanly drawn: pass only if a careful artist would accept it next to the reference without it looking thinner, flatter or more "sticker-like". A piece that is plainly the reference itself or equally rich passes. When in doubt, fail.
"score" is an auxiliary 1-10 rating (reference = 8-9); it never decides anything.`;


export const OBJECT_GATE_OUTPUT_FORMAT = `Reply ONLY JSON:
{"facing": "south"|"east"|"west"|"north"|"round"|"unclear",
 "kind_matches": bool,
 "surfaces": [{"part": string, "rows": "a-b", "evidence": "a"|"b"|"c"|"d"|"none"|"decor"|"seat_back", "front_edge_line_row": int|null, "eave_shadow_rows": string|null}],
 "main_top_rows": int,
 "front_face_rows": int,
 "side_face_visible": bool,
 "all_major_parts_have_top": bool,
 "round_cap": null | {"cap_rows": int, "cap_width": int, "shaft_width": int, "rounded_at_both_edges": bool},
 "reads_as": "three_quarter"|"front_elevation"|"side_profile_no_top"|"top_down_slab"|"other",
 "evidence": string}
"kind_matches": the caller-supplied kind plausibly describes this object. "main_top_rows" = height in rows of the main top surface (0 when none; 1-2 for a rim). "side_face_visible": an isometric receding side face is drawn (not the normal south face). "all_major_parts_have_top" is false if one big part (a backrest panel, a staircase, a beam, a chimney) is drawn only as a vertical face where a horizontal surface should be visible. Decor parts do not count here, and for kind seat the backrest and armrests (seat_back) do not count here. "round_cap" is filled ONLY for column-like objects (pillar, stele, rune stone, lantern post): cap_width and shaft_width come from the width profile; rounded_at_both_edges is true only when the cap's widest rows are bounded by narrower rows both above AND below (an ellipse plate), false for a dome or hat that ends flat.
"reads_as": three_quarter = the main body has a top surface and a front face of 3+ rows; front_elevation = no top surface (or only a rim); side_profile_no_top = a profile silhouette without a horizontal surface; top_down_slab = no front face.`;

export const OBJECT_GATE_STYLE_OUTPUT_FORMAT = `Reply ONLY JSON:
{"ref_kind_matches": bool, "shading_steps": int, "reference_steps": int, "outline": "dark_material_tone"|"near_black"|"mixed"|"none", "texture": "rich"|"some"|"flat", "flat_fills": bool, "density": "equal_or_richer"|"slightly_lower"|"much_lower", "score": int, "evidence": string, "verdict": "pass"|"fail"}`;


/**
 * 규칙 v7 「눈」 호출(3번): 사실 서술(열 훑기·행 번호)을 일부러 주지 않고 확대 그림 하나와 실제 위반/정상 쌍만 보여 주고 전체 인상으로 right|borderline|wrong 을 답하게 한다.
 * 사실 서술 판정자는 「윗면 4행」을 곧이곧대로 세어 앞면 입면(좌판 띠·수조 테두리·무대 차양)을 통과시키는 일이 있었고, 전체 인상 판정자는 그것을 잡았다 — 약점이 서로 달라 둘을 합친다.
 * 눈은 **거부권만** 갖는다: 사실 판정이 pass 인데 눈이 3번 중 2번 이상 wrong 이면 pass 가 아니라 refer. 눈이 right 라고 해서 통과가 되지는 않는다.
 */
export const OBJECT_GATE_EYE_RUBRIC = `You are an independent pixel-art reviewer for a top-down JRPG drawn in 3/4 view (camera south of the object, looking down ~45 degrees). A correctly drawn standing object shows its TOP surfaces (horizontal surfaces seen from above, foreshortened, usually 4-6 pixel rows for a 16px-scale object) AND its FRONT face. A WRONG drawing is a flat front elevation (no readable horizontal top surface, only a thin 1-2 row rim/outline), a flat plan view, or an isometric side view.
You get image 1 = the candidate magnified 10x, image 2 = reference pairs of the same objects (red = WRONG, green = RIGHT). Judge only the camera angle/structure, never the subject or the style.
SEATS (rules v10, user decision 2026-10-20): when the question says the object is a seat (chair, sofa, bench, pew, stool), its backrest and armrests may be drawn face-on with no top; that alone is not wrong. Judge only whether the SEAT surface where one sits is seen from above (count top_rows on the seat surface) with a front face below it.`;
export const OBJECT_GATE_EYE_OUTPUT_FORMAT = `Reply ONLY JSON: {"verdict":"right"|"borderline"|"wrong","top_rows":int,"why":"one sentence naming the rows you looked at"}`;
export type ObjectGateEyeAnswer = { verdict?: "right" | "borderline" | "wrong" | string; top_rows?: number; why?: string };
/** 눈 판정 횟수와 거부권 문턱(wrong 이 이 횟수 이상이면 pass → refer). */
export const OBJECT_GATE_EYE_RUNS = 3;
export const OBJECT_GATE_EYE_VETO = 2;

export type ObjectGateState = "pass" | "fail" | "refer";

/** 판정자 한 번의 3/4 답(사실 서술). 통과·불합격은 판정자가 적지 않는다. */
export type ObjectGateJudgeAnswer = {
  facing?: string; kind_matches?: boolean; main_top_rows?: number; front_face_rows?: number; side_face_visible?: boolean; all_major_parts_have_top?: boolean;
  round_cap?: { cap_rows?: number; cap_width?: number; shaft_width?: number; rounded_at_both_edges?: boolean } | null;
  reads_as?: string; evidence?: string; surfaces?: Array<{ part?: string; rows?: string; evidence?: string; front_edge_line_row?: number | null; eave_shadow_rows?: string | null }>;
};

export type ObjectGateStyleAnswer = {
  ref_kind_matches?: boolean; shading_steps?: number; reference_steps?: number;
  outline?: "dark_material_tone" | "near_black" | "mixed" | "none" | string; texture?: "rich" | "some" | "flat" | string; flat_fills?: boolean;
  density?: "equal_or_richer" | "slightly_lower" | "much_lower" | string; score?: number; evidence?: string; verdict?: string;
};

export type ObjectGateDecision = { state: ObjectGateState; pass: boolean; reasons: string[] };
export type ObjectGateBothDecision = { state: ObjectGateState; pass: boolean; view34: ObjectGateDecision; style: ObjectGateDecision; reasons: string[] };

const decision = (state: ObjectGateState, reasons: string[]): ObjectGateDecision => ({ state, pass: state === "pass", reasons });

/** 한 판정이 「분명히 3/4 가 아니다」인지·「분명히 3/4 다」인지. 판정자 답을 규칙으로 계산한다. */
export const OBJECT_GATE_MIN_FRONT_ROWS = 3;
/** 윗면 행 / 앞면 행이 이 값을 넘으면 앞면이 거의 없는 평면도로 본다(구조물 제외). */
export const OBJECT_GATE_MAX_TOP_TO_FRONT = 3;
/** 기둥 머리 판이 몸통보다 튀어나와야 하는 총 폭(양쪽 합). 계약의 기준 기둥은 6, 옛(위반) 기둥은 4 였다. */
export const OBJECT_GATE_MIN_CAP_OVERHANG = 6;
/** 사용자가 직접 정의한 영역(옆·뒤를 보는 의자)은 자동 통과시키지 않는다(modern-style-bible §11-4b: 옆모습 L자는 정상이라는 사용자 판정과 4~6행 계약이 부딪친다). */
const HUMAN_DEFINED_SEAT_FACINGS = ["east", "west", "north"];

/** 규칙 v7: 맨 위에서 시작하는 아주 큰(세로 12행 이상) 부분이 윗면 증거 없이 세로 면뿐이면(왕좌 등받이) 윗면은 그 아래 작은 부분(좌판)일 뿐이다 — 물체의 윗끝이 3/4 가 아니다. */
export const OBJECT_GATE_CROWN_MIN_ROWS = 12;
const rowSpan = (rows: unknown): [number, number] | null => {
  const m = /^\s*(\d+)\s*-\s*(\d+)/.exec(String(rows ?? ""));
  return m ? [Number(m[1]), Number(m[2])] : null;
};
/** 판정자가 적은 부분 중 맨 위(행 0~2)에서 시작해 12행 이상이며 윗면 증거가 none 인 것이 있으면 그 행 수. */
export function crownWithoutTopRows(a: ObjectGateJudgeAnswer, kind?: ObjectGateKind): number {
  for (const p of a.surfaces ?? []) {
    const r = rowSpan(p.rows);
    // 규칙 v10: 등받이·팔걸이(seat_back)는 seat 종류에서만 면제다. 다른 종류가 seat_back 이라 적으면 증거 없음(none)으로 센다.
    const none = p.evidence === "none" || (p.evidence === "seat_back" && kind !== "seat");
    if (r && r[0] <= 2 && r[1] - r[0] + 1 >= OBJECT_GATE_CROWN_MIN_ROWS && none) return r[1] - r[0] + 1;
  }
  return 0;
}
/** 가장 위 부분의 윗면 증거가 「안쪽 내용물(d)」뿐이고 앞면이 윗면의 3배를 넘으면 정면 단면(어항) 이다. */
export const OBJECT_GATE_MAX_FRONT_TO_TOP_FOR_CONTENTS = 3;
function topEvidenceIsContentsOnly(a: ObjectGateJudgeAnswer): boolean {
  let best: { start: number; len: number; ev?: string } | null = null;
  for (const p of a.surfaces ?? []) {
    const r = rowSpan(p.rows); if (!r) continue;
    const len = r[1] - r[0] + 1;
    if (!best || r[0] < best.start || (r[0] === best.start && len > best.len)) best = { start: r[0], len, ev: p.evidence };
  }
  return best?.ev === "d";
}

export type ObjectGateRunFlags = { clear: boolean; notClear: boolean; why: string[] };

/** 판정 한 번 → 「분명한 3/4」 / 「분명한 위반」 / 둘 다 아님. */
export function judgeRunFlags(kind: ObjectGateKind, a: ObjectGateJudgeAnswer | null): ObjectGateRunFlags {
  if (!a || typeof a.reads_as !== "string") return { clear: false, notClear: true, why: ["판정자 답을 읽지 못함"] };
  const rule = OBJECT_GATE_KINDS[kind] ?? OBJECT_GATE_KINDS.other;
  const need = rule.minOpeningRows ?? rule.minTopRows ?? 3;
  const top = typeof a.main_top_rows === "number" ? a.main_top_rows : 0, front = typeof a.front_face_rows === "number" ? a.front_face_rows : 0;
  const why: string[] = [];
  let clear = a.reads_as === "three_quarter";
  if (!clear) why.push(`투영이 3/4 아님(${a.reads_as})`);
  if (top < need) { clear = false; why.push(`윗면 ${top}행 < ${need}`); }
  const minFront = Math.max(OBJECT_GATE_MIN_FRONT_ROWS, rule.minFrontRows ?? 0);
  if (front < minFront) { clear = false; why.push(`앞면 ${front}행 < ${minFront}`); }
  if (a.all_major_parts_have_top === false) { clear = false; why.push("큰 부분 하나가 윗면 없이 세로 면으로만 그려짐"); }
  // 규칙 v10: 등받이·팔걸이 면제(seat_back)는 seat 종류만. 다른 종류가 이 증거를 쓰면 분명한 3/4 로 보지 않는다.
  const misusedSeatBack = kind !== "seat" && (a.surfaces ?? []).some(p => p.evidence === "seat_back");
  if (misusedSeatBack) { clear = false; why.push("seat 가 아닌데 등받이 면제(seat_back)를 씀"); }
  const flatPlan = kind !== "structure" && front > 0 && top / front > OBJECT_GATE_MAX_TOP_TO_FRONT;
  if (flatPlan) { clear = false; why.push(`윗면/앞면 ${top}/${front} — 앞면이 거의 없는 평면도`); }
  const crown = kind === "structure" || kind === "column" ? 0 : crownWithoutTopRows(a, kind);
  if (crown) { clear = false; why.push(`맨 위의 큰 부분(${crown}행)이 윗면 없이 세로 면뿐 — 윗끝이 3/4 가 아님`); }
  const contentsOnly = kind !== "structure" && topEvidenceIsContentsOnly(a) && top > 0 && front > OBJECT_GATE_MAX_FRONT_TO_TOP_FOR_CONTENTS * top;
  if (contentsOnly) { clear = false; why.push(`윗면 증거가 안쪽 내용물뿐이고 앞면/윗면 ${front}/${top} — 정면 단면`); }
  if (kind === "column") {
    const cap = a.round_cap;
    const overhang = cap && typeof cap.cap_width === "number" && typeof cap.shaft_width === "number" ? cap.cap_width - cap.shaft_width : -1;
    if (!cap || cap.rounded_at_both_edges !== true || overhang < OBJECT_GATE_MIN_CAP_OVERHANG) { clear = false; why.push(`기둥 머리가 타원 판이 아님(위아래 둥글림 ${cap?.rounded_at_both_edges}, 몸통보다 ${overhang} 튀어나옴 < ${OBJECT_GATE_MIN_CAP_OVERHANG})`); }
  }
  const notClear = ["front_elevation", "side_profile_no_top", "top_down_slab"].includes(a.reads_as) || top <= need - 2 || a.all_major_parts_have_top === false || flatPlan || crown > 0 || contentsOnly;
  return { clear, notClear, why };
}

/**
 * 여러 번의 3/4 판정을 합친다(3상태). pass = 4번 중 3번 이상이 분명한 3/4 · fail = 3번 이상이 분명한 위반 · 그 밖은 refer(사람 확인).
 * 답을 못 읽은 판정은 「분명한 위반」 표로 센다(판정자가 죽으면 통과가 아니라 막힌다). 시점 규칙 면제 종류는 「종류가 맞다」가 과반일 때만 통과.
 */
export function decideObjectGate(kind: ObjectGateKind, answers: Array<ObjectGateJudgeAnswer | null>): ObjectGateDecision {
  const rule = OBJECT_GATE_KINDS[kind] ?? OBJECT_GATE_KINDS.other;
  const n = answers.length;
  if (!n) return decision("fail", ["판정 없음"]);
  const read = answers.filter((a): a is ObjectGateJudgeAnswer => !!a);
  if (n - read.length > n / 2) return decision("fail", ["판정자 답을 읽지 못함"]);
  const kindBad = read.filter(a => a.kind_matches === false).length + (n - read.length);
  const kindOk = n - kindBad;
  if (kindBad > n / 2) return decision("fail", ["종류 불일치"]);
  // humanOnly(front_prop): 면제 종류처럼 종류 판정이 맞아도 자동 통과시키지 않는다 — 위반 144장을 이 종류로 거짓 선언한 적대 시험에서 28장이 종류 판정 과반을 얻어 통과했다(해먹·베틀·신도석처럼 실제로 정면 틀이다). 사람 확인(보류)으로만 간다.
  if (rule.humanOnly) return decision("refer", ["정면형 소품(front_prop) — 종류 선언은 자동 통과가 아니라 사람 확인(보류)"]);
  // 시점 규칙 면제 종류는 「종류가 맞다」가 4번 중 3번 이상일 때만 통과다. 2:2 로 갈리면 통과가 아니라 보류(사람 확인).
  if (rule.exempt) return kindOk >= Math.ceil(n * 0.75) ? decision("pass", []) : decision("refer", [`종류 판정이 갈림(맞다 ${kindOk}/${n}) — 면제 종류는 과반이 아니라 3/4 이상이 맞다고 해야 통과`]);
  const flags = answers.map(a => judgeRunFlags(kind, a));
  const clearN = flags.filter(f => f.clear).length, notN = flags.filter(f => f.notClear).length;
  const need = Math.ceil(n * 0.75);
  const reasonsOf = (pick: (f: ObjectGateRunFlags) => boolean) => {
    const count = new Map<string, number>();
    for (const f of flags.filter(pick)) for (const w of f.why) count.set(w, (count.get(w) ?? 0) + 1);
    return [...count.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([w, c]) => `${w} (${c}/${n})`);
  };
  if (notN >= need) return decision("fail", reasonsOf(f => f.notClear));
  const side = read.filter(a => a.side_face_visible === true).length;
  const facing = read.map(a => a.facing);
  const humanSeat = kind === "seat" && facing.filter(f => f && HUMAN_DEFINED_SEAT_FACINGS.includes(f)).length > n / 2;
  if (clearN >= need && !(kind !== "structure" && side > n / 2) && !humanSeat) return decision("pass", []);
  const why = [`판정자 의견이 갈림(분명한 3/4 ${clearN}/${n}, 분명한 위반 ${notN}/${n})`];
  if (humanSeat) why.push("옆·뒤를 보는 의자는 사용자 정의 영역이라 자동 통과시키지 않는다");
  if (kind !== "structure" && side > n / 2) why.push("옆면(아이소)이 보인다는 판정이 과반");
  return decision("refer", [...why, ...reasonsOf(f => !f.clear)]);
}

/**
 * 화풍 판정(3상태). 한 번의 판정이 「걸림」이 있는지: 판정자 verdict fail · 윤곽 근흑 · 평면 채움 · 질감 없음 · 칸 정보량 훨씬 낮음 · 명암 단계 하한 미달.
 * 걸린 판정이 0~1번이면 pass, 3번 이상이면 fail, 그 사이(2번)는 refer. 답을 못 읽은 판정은 걸린 것으로 센다.
 */
export function decideObjectGateStyle(answers: Array<ObjectGateStyleAnswer | null>): ObjectGateDecision {
  const n = answers.length;
  if (!n) return decision("fail", ["판정 없음"]);
  const per = answers.map(s => {
    if (!s) return ["화풍 답을 읽지 못함"];
    const w: string[] = [];
    if (s.verdict !== "pass") w.push("판정자 fail");
    if (s.outline === "near_black") w.push("윤곽이 근흑(재질 어두운 톤 아님)");
    if (s.flat_fills === true) w.push("평면 채움");
    if (s.texture === "flat") w.push("질감 없음");
    if (s.density === "much_lower") w.push("칸 정보량이 기준보다 훨씬 낮음");
    if ((typeof s.shading_steps === "number" ? s.shading_steps : 0) < OBJECT_GATE_STYLE_MIN_STEPS) w.push(`명암 ${s.shading_steps ?? 0}단 < ${OBJECT_GATE_STYLE_MIN_STEPS}`);
    return w;
  });
  const hit = per.filter(w => w.length).length;
  const count = new Map<string, number>();
  for (const w of per) for (const x of w) count.set(x, (count.get(x) ?? 0) + 1);
  const reasons = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w, c]) => `${w} (${c}/${n})`);
  if (hit <= n / 4) return decision("pass", []);
  if (hit >= Math.ceil(n * 0.75)) return decision("fail", reasons);
  return decision("refer", [`화풍 판정이 갈림(걸린 판정 ${hit}/${n})`, ...reasons]);
}

/** 명암 단계 하한. 버들항은 재질마다 5~6단이다. 작은 조각이 한 재질에 4단도 못 쓰면 얕다. */
export const OBJECT_GATE_STYLE_MIN_STEPS = 4;

/** 눈의 거부권: 사실 판정이 pass 인데 눈이 wrong 을 OBJECT_GATE_EYE_VETO 번 이상 말하면 refer. 시점 규칙 면제 종류는 눈을 부르지 않는다. 눈 답이 하나도 없으면 영향 없음(옛 영수증·호출 생략 표본). */
export function applyEyeVeto(kind: ObjectGateKind, d: ObjectGateDecision, eye: Array<ObjectGateEyeAnswer | null>): ObjectGateDecision {
  if (d.state !== "pass" || OBJECT_GATE_KINDS[kind]?.exempt || !eye.length) return d;
  const wrong = eye.filter(e => e?.verdict === "wrong").length;
  return wrong >= OBJECT_GATE_EYE_VETO ? decision("refer", [`독립 눈이 「3/4 아님」 ${wrong}/${eye.length} — 사실 판정은 통과였지만 전체 인상이 정면 입면`]) : d;
}

/** 3/4 와 화풍의 합: 둘 다 pass → pass, 하나라도 fail → fail, 그 밖 → refer. */
export function combineObjectGateStates(a: ObjectGateState, b: ObjectGateState): ObjectGateState {
  if (a === "fail" || b === "fail") return "fail";
  return a === "pass" && b === "pass" ? "pass" : "refer";
}

/** 한 묶음의 판정 답에서 3/4 와 화풍을 따로 계산한다. */
export function decideObjectGateBoth(kind: ObjectGateKind, view34Answers: Array<ObjectGateJudgeAnswer | null>, styleAnswers: Array<ObjectGateStyleAnswer | null>, eyeAnswers: Array<ObjectGateEyeAnswer | null> = []): ObjectGateBothDecision {
  const view34 = applyEyeVeto(kind, decideObjectGate(kind, view34Answers), eyeAnswers), style = decideObjectGateStyle(styleAnswers);
  const state = combineObjectGateStates(view34.state, style.state);
  return { state, pass: state === "pass", view34, style, reasons: [...view34.reasons.map(r => `3/4: ${r}`), ...style.reasons.map(r => `화풍: ${r}`)] };
}

/** 판정 프로필 — 이 값이 바뀌면 프로필 해시가 바뀌고, 새 프로필은 보정을 다시 통과해야 쓸 수 있다. */
export const OBJECT_GATE_PROFILE = {
  rulesVersion: OBJECT_GATE_RULES_VERSION,
  styleFactsVersion: 3, // node/facts.ts styleFacts — 보이는 색조·근사 평면 채움(규칙 v9). 화풍 프롬프트 해시에만 들어간다(3/4 답 캐시는 그대로).
  factsVersion: 2, // node/facts.ts — 판정자에게 주는 정확한 열 훑기·실루엣 폭·화풍 측정(알고리즘을 바꾸면 올린다)
  rubric: OBJECT_GATE_RUBRIC,
  outputFormat: OBJECT_GATE_OUTPUT_FORMAT,
  styleRubric: OBJECT_GATE_STYLE_RUBRIC,
  styleOutputFormat: OBJECT_GATE_STYLE_OUTPUT_FORMAT,
  styleKinds: OBJECT_GATE_STYLE_KINDS,
  eyeRubric: OBJECT_GATE_EYE_RUBRIC,
  eyeOutputFormat: OBJECT_GATE_EYE_OUTPUT_FORMAT,
  eyeRuns: OBJECT_GATE_EYE_RUNS,
  eyeVeto: OBJECT_GATE_EYE_VETO,
  styleMinSteps: OBJECT_GATE_STYLE_MIN_STEPS,
  minFrontRows: OBJECT_GATE_MIN_FRONT_ROWS,
  maxTopToFront: OBJECT_GATE_MAX_TOP_TO_FRONT,
  minCapOverhang: OBJECT_GATE_MIN_CAP_OVERHANG,
  crownMinRows: OBJECT_GATE_CROWN_MIN_ROWS,
  maxFrontToTopForContents: OBJECT_GATE_MAX_FRONT_TO_TOP_FOR_CONTENTS,
  // wall_structure 는 Opus 최종 판정(v9)에서 더한 종류다 — 옛 판정자 프로필 해시를 그대로 두려고 뺀다.
  kinds: Object.fromEntries(Object.entries(OBJECT_GATE_KINDS).filter(([k]) => k !== 'wall_structure')),
  // 판정자는 Claude Sonnet 5.5 high 하나(claude -p 헤드리스, 그림 첨부). 3/4 호출 4번 + 화풍 호출 4번. 신원은 프로필 해시에 들어가고 `status` 가 보여 준다. 다른 모델로 몰래 넘어가지 않는다 — Sonnet 이 안 되면 멈춘다.
  judges: [
    { id: "sonnet", provider: "claude-cli", model: "claude-sonnet-5-5", effort: "high" },
  ],
  runsPerJudge: 4,
  magnify: 10,
  combine: "facts-then-rules-3state-v10-seatback" as const,
};

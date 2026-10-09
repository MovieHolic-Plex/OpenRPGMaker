/**
 * 공용 오브젝트 게이트 — 3/4 시점 판정 규칙(판정자 지시문·종류별 기준·판정 계산). 브라우저·노드 공용(의존 없음).
 *
 * 배경(2026-10-08): 무림·던전 기물 판에서 윗면 없는 정면 입면도(청동 정·징 틀·무기 걸이·서가·약재장·상자·화로…)가
 * 하네스 관문(작업자가 선언한 윗면 행만 보는 F)과 LLM 검수자를 모두 통과했다. 사용자: 「에디터든 어느 하네싱이든
 * 오브젝트를 생성하면 검증 게이트를 거치게끔 해야 하는데 전혀 안 되어 있구나」.
 * 그래서 판정은 ① 작업자 선언을 받지 않고 ② 판정자에게 숫자(윗면 행 수·아가리)를 재게 해 규칙으로 계산하고
 * ③ 판정자 둘 × 여러 번이 만장일치일 때만 통과로 하며 ④ 위반 표본을 하나도 통과시키지 않는 프로필만 쓴다(보정).
 * 계약 원문: tiledata/atlas-pick/modern-style-bible.md §10·§11, 문서 openwiki/harnesses/object-gate.md.
 */

export const OBJECT_GATE_RULES_VERSION = 2;

export type ObjectGateKind =
  | "tall_furniture" | "low_furniture" | "seat" | "frame" | "container" | "round_body" | "column" | "box"
  | "structure" | "figure" | "organic" | "debris" | "flat" | "wall_mounted" | "terrain" | "other";

/** 종류 → 판정자에게 주는 뜻 · 윗면 최소 행 수(없으면 윗면 행 수로 떨어뜨리지 않는다). */
/**
 * exempt = 시점 규칙을 재지 않는 종류(실내 기준 RUBRIC 의 EXEMPT·깔개·벽 부착물). 판정자 과반이 「종류가 맞다」고 해야 한다 —
 * 진열장을 organic 이라 불러 빠져나가는 것을 막는다.
 */
export const OBJECT_GATE_KINDS: Record<ObjectGateKind, { meaning: string; minTopRows?: number; minOpeningRows?: number; exempt?: boolean }> = {
  tall_furniture: { meaning: "tall furniture standing against a wall: bookshelf, cabinet, wardrobe, drawer chest, cupboard, fireplace", minTopRows: 3 },
  low_furniture: { meaning: "low furniture: table, desk, tea table, bed, counter, bench top", minTopRows: 3 },
  seat: { meaning: "seat: stool, chair, cushion seat (the seat surface must be seen from above)", minTopRows: 3 },
  frame: { meaning: "open frame or rack: weapon rack, gong/bell frame, target stand, sandbag frame, cell bars, well pulley frame (its horizontal beams and base must show top faces)", minTopRows: 3 },
  container: { meaning: "container with an opening: pot, jar, cauldron/ding, well, brazier, censer, open coffin (the inside of the opening must be seen from above)", minOpeningRows: 4 },
  round_body: { meaning: "closed cylinder: drum, barrel, round stool (the top cap is an ellipse seen from above)", minTopRows: 3 },
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
The camera is south of the object looking down at about 45 degrees, so every standing object shows its TOP surface (horizontal surfaces seen from above, foreshortened) AND its FRONT (south) face. No receding isometric side faces.
Note: an object that faces east/west shows its own side silhouette as its south face (e.g. an L-shaped chair profile) — that is normal. What fails is a horizontal surface (seat, table top, lid, opening, beam top, cap, base) that is NOT visible from above.
A "pure front elevation" (object drawn straight from the side like an architectural elevation, with only a 0-2px line where the top should be) is a FAIL.
The image is magnified 10x; the numbers on the left are source pixel row indices (every 2 rows); the faint grid is 1 source pixel.
Judge the MAIN BODY of the object (the largest volume), not small details like handles, ornaments, incense sticks or a base plinth. Do not give credit for a top visible only on a small part.
Measure strictly in source pixels:
- top_rows: how many pixel rows tall is the visible top surface of the main body (from its back edge to its front edge). A 1-2px rim, cap line or edge highlight is NOT a top surface.
- opening_visible (containers only, else null): the inside of the opening is shown as an ellipse (you can see into it or its interior surface). A single dark line across the rim is NOT an opening.
- opening_rows (containers only, else null): how many pixel rows tall is the visible inside of the opening, between the back rim and the front rim (rims excluded).
- side_face_visible: an isometric receding side face is drawn (not the normal south face).
- pure_front_elevation: the main body is drawn as a flat front view.
- kind_matches: the caller-supplied kind plausibly describes this object (false if e.g. a cabinet is labelled organic or flat).
Be strict: when in doubt, fail. Reply ONLY JSON:
{"main_body": string, "kind_matches": bool, "top_rows": int, "opening_visible": bool|null, "opening_rows": int|null, "side_face_visible": bool, "pure_front_elevation": bool, "evidence": string, "verdict": "pass"|"fail"}`;

export type ObjectGateJudgeAnswer = {
  main_body?: string; kind_matches?: boolean; top_rows?: number; opening_visible?: boolean | null; opening_rows?: number | null;
  side_face_visible?: boolean; pure_front_elevation?: boolean; evidence?: string; verdict?: string;
};

/** 판정자 한 번의 답을 규칙으로 계산한다(보고용). 판정자가 pass 라 해도 숫자가 기준에 못 미치면 fail. */
export function decideObjectGateRun(kind: ObjectGateKind, answer: ObjectGateJudgeAnswer | null): { pass: boolean; reasons: string[] } {
  if (!answer) return { pass: false, reasons: ["판정자 답을 읽지 못함"] };
  return decideObjectGate(kind, [answer]);
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
export function decideObjectGate(kind: ObjectGateKind, answers: Array<ObjectGateJudgeAnswer | null>): { pass: boolean; reasons: string[] } {
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

/** 판정 프로필 — 이 값이 바뀌면 프로필 해시가 바뀌고, 새 프로필은 보정을 다시 통과해야 쓸 수 있다. */
export const OBJECT_GATE_PROFILE = {
  rulesVersion: OBJECT_GATE_RULES_VERSION,
  rubric: OBJECT_GATE_RUBRIC,
  kinds: OBJECT_GATE_KINDS,
  judges: [
    { id: "gpt", provider: "openai-codex", model: "gpt-6.1-sol", effort: "medium" },
    { id: "gemini", provider: "google-antigravity", model: "gemini-3.8-flash", effort: "medium" },
  ],
  runsPerJudge: 2,
  magnify: 10,
  combine: "median-majority" as const,
};

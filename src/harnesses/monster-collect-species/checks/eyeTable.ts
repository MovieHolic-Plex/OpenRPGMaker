/**
 * 종별 눈 표 검사 — 눈 규칙 판본 5 (2026-10-20, 사용자 「몬스터 눈알 교정」).
 *
 * `harness-data/monster-collect-species/eyes.json` 이 종마다 눈 자리의 정답이다(64 캔버스 좌표 상자 [x, y, w, h]).
 * 여기서는 커밋된 앞모습이 그 표와 맞는지, 그리고 그 자리가 눈으로서 올바른지를 기계로 본다:
 *  - V0 표↔그림: 상자 안에 실제로 눈(어두운 눈동자 + 흰 하이라이트)이 있다 — 표가 그림과 따로 놀지 않게
 *  - V1 몸 안: 상자와 둘레 한 칸이 전부 불투명하다 — 실루엣 밖 허공에 찍힌 눈을 잡는다
 *  - V2 윤곽 붙음: 둘레 한 칸에 어두운 칸이 많지 않다 — 먼 눈이 윤곽선에 붙어 홈처럼 읽히는 것을 잡는다
 *  - V3 대비: 둘레 살갗 밝기(중앙값) − 눈동자 밝기 ≥ 0.3
 *  - V4 배치: 3/4 먼 눈은 가까운 눈 왼쪽·같거나 작고·높이차 ≤2·간격 1~8, 정면 두 눈은 같은 크기·같은 높이
 *  - V5 옛 눈 잔상: 상자 밖 두 칸 안의 (윤곽 아닌) 어두운 칸 ≤ 한도 — 덮어 그린 옛 눈이 비어져 나온 것을 잡는다
 *  - V7 양식: 사각 5×5 눈 금지(둥근 틀: 높이 ≥6·왼쪽 위 모서리 살갗), 한 진화 계통 안에서 양식이 같다
 * V6(뒷모습에 눈 없음)은 `checks/eyes.ts` checkEyes(back), V8(동결 종 해시)은 시험이 본다.
 * 눈자루(stalk) 눈은 몸 밖으로 나가는 것이 정상이라 V1·V2·V4 를 보지 않는다.
 */
import { isOpaque, pixelAt, type RgbaImage } from "../pixel/image";
import { oklabCached } from "../pixel/oklab";

export type EyeBox = readonly [number, number, number, number];
export type EyeAnatomy = "threequarter" | "profile" | "frontal" | "stalk";
/**
 * round = 둥근 BW 눈 틀(#6/#7/#10), hand = 스타터 손 도트 보석눈, square = 사각 5×5(폐지 대상), reference = 동결 기준종.
 * 6차(2026-10-20, 사용자 「다 눈이 똑같아서 불만」): 종마다 다른 눈 — `scripts/content/monsters/eye_catalog_r6.py` 의 틀 이름이 양식이다.
 */
export const EYE_STYLES = ["round", "hand", "square", "reference", "glossy", "roundtr", "bead", "beadsm", "almond", "sleepy", "sleepybig", "sharp", "slit", "slitalm", "compound", "glow", "ring", "pin", "sparkle", "stalk"] as const;
export type EyeStyle = (typeof EYE_STYLES)[number];
export const EYE_CHECK_IDS = ["V0", "V1", "V2", "V3", "V4", "V5", "V7"] as const;
export type EyeCheckId = (typeof EYE_CHECK_IDS)[number];

export type EyeEntry = {
  anatomy: EyeAnatomy;
  style: EyeStyle;
  near: EyeBox;
  /** 3/4 먼 눈(가까운 눈 왼쪽). 얼굴 안에 자리가 없어 생략했으면 null */
  far: EyeBox | null;
  /** 정면(frontal)·눈자루(stalk)의 둘째 눈 */
  second?: EyeBox;
  /** 동결 종: 앞·뒤 번들 그림의 화소 해시(sha256 of RGBA). 다르면 시험 실패 */
  frozen?: { front: string; back: string };
  /** 사람이 고르기를 기다리는 종(그림을 바꾸지 않는다) */
  pending?: string;
  /** 손 도트 2·3차(2026-10-20, `redraw_failed_eyes_r2.py` + `eye-patches-r2.json` / `--patches eye-patches-r3.json`): authored 앞모습 해시 from → to. 옛 `repair` 를 대신한다 */
  patch?: { from: string; to: string; source: string };
  /** 3차: `field_chip.py derive` 가 줄인 눈 잔상을 지우고 다시 찍는다(정면 second 포함) */
  chip?: "clean";
  /** 지금 그림이 실패하는 검사와 이유. 시험은 실제 실패 목록이 이 키들과 정확히 같아야 통과한다 — 고치면 지워야 한다 */
  accept?: Partial<Record<EyeCheckId, string>>;
};

export type EyeTable = { version: 1; species: Record<string, EyeEntry> };
export type EyeFinding = { check: EyeCheckId; message: string };

export const EYE_TABLE_RULES = {
  darkL: 0.4,
  highlightL: 0.85,
  highlightMaxChroma: 0.06,
  minNearDarkRatio: 0.35,
  /** V2: 둘레 한 칸 중 어두운 칸 비율 상한 */
  maxRingDark: 0.3,
  minContrast: 0.3,
  maxFarGap: 8,
  maxDy: 2,
  /** V5: 상자 밖 두 칸 안 어두운 칸 수 상한 */
  maxLeftover: 3,
} as const;

type Role = "near" | "far" | "second";
type Placed = { role: Role; box: EyeBox };

function placed(entry: EyeEntry): Placed[] {
  const out: Placed[] = [{ role: "near", box: entry.near }];
  if (entry.second) out.push({ role: "second", box: entry.second });
  if (entry.far) out.push({ role: "far", box: entry.far });
  return out;
}

function inBox(box: EyeBox, x: number, y: number, pad = 0): boolean {
  return x >= box[0] - pad && x < box[0] + box[2] + pad && y >= box[1] - pad && y < box[1] + box[3] + pad;
}

function lightness(image: RgbaImage, x: number, y: number): number {
  const p = pixelAt(image, x, y);
  return oklabCached(p[0], p[1], p[2])[0];
}

function inside(image: RgbaImage, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < image.width && y < image.height;
}

/** 실루엣 가장자리: 4방향 이웃 중 투명(또는 캔버스 밖)이 있는 불투명 칸 */
function isEdge(image: RgbaImage, x: number, y: number): boolean {
  if (!isOpaque(image, x, y)) return false;
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (!inside(image, x + ox, y + oy) || !isOpaque(image, x + ox, y + oy)) return true;
  }
  return false;
}

/** 상자를 pad 만큼 넓힌 고리(상자 자신·다른 눈 상자 제외) */
function ring(box: EyeBox, all: Placed[], pad: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = box[1] - pad; y < box[1] + box[3] + pad; y += 1) {
    for (let x = box[0] - pad; x < box[0] + box[2] + pad; x += 1) {
      if (all.some((p) => inBox(p.box, x, y))) continue;
      out.push([x, y]);
    }
  }
  return out;
}

function boxStats(image: RgbaImage, box: EyeBox): { dark: number; darkL: number; highlights: number; total: number } {
  let dark = 0, darkSum = 0, highlights = 0, total = 0;
  for (let y = box[1]; y < box[1] + box[3]; y += 1) {
    for (let x = box[0]; x < box[0] + box[2]; x += 1) {
      if (!inside(image, x, y) || !isOpaque(image, x, y)) continue;
      total += 1;
      const p = pixelAt(image, x, y);
      const lab = oklabCached(p[0], p[1], p[2]);
      if (lab[0] < EYE_TABLE_RULES.darkL) { dark += 1; darkSum += lab[0]; }
      else if (lab[0] >= EYE_TABLE_RULES.highlightL && Math.hypot(lab[1], lab[2]) <= EYE_TABLE_RULES.highlightMaxChroma) highlights += 1;
    }
  }
  return { dark, darkL: dark === 0 ? 1 : darkSum / dark, highlights, total };
}

/** 한 종의 앞모습을 표 항목으로 검사한다. 빈 배열 = 통과. 동결 기준종(사용자 승인 #6/#7/#8/#10)은 그림이 곧 기준이라 해시(V8)로만 본다. */
export function checkEyePlacement(image: RgbaImage, entry: EyeEntry): EyeFinding[] {
  const findings: EyeFinding[] = [];
  if (entry.frozen) return findings;
  const all = placed(entry);
  const stalk = entry.anatomy === "stalk";
  for (const { role, box } of all) {
    const st = boxStats(image, box);
    const minDark = role === "far" ? 2 : Math.ceil(box[2] * box[3] * EYE_TABLE_RULES.minNearDarkRatio);
    if (st.highlights < 1 || st.dark < minDark) findings.push({ check: "V0", message: `${role} 상자 [${box.join(",")}] 에 눈이 없다 (어두운 칸 ${st.dark}, 하이라이트 ${st.highlights})` });
    const around = ring(box, all, 1);
    if (!stalk) {
      const air = around.filter(([x, y]) => !inside(image, x, y) || !isOpaque(image, x, y)).length + (box[2] * box[3] - st.total);
      if (air > 0) findings.push({ check: "V1", message: `${role} 눈이 몸 밖에 걸쳤다 (상자·둘레 투명 칸 ${air})` });
      const opaqueRing = around.filter(([x, y]) => inside(image, x, y) && isOpaque(image, x, y));
      const darkRing = opaqueRing.filter(([x, y]) => lightness(image, x, y) < EYE_TABLE_RULES.darkL).length;
      if (around.length > 0 && darkRing / around.length > EYE_TABLE_RULES.maxRingDark) findings.push({ check: "V2", message: `${role} 눈 둘레 ${darkRing}/${around.length} 칸이 어둡다 — 윤곽선에 붙어 홈처럼 읽힌다` });
    }
    const skin = around.filter(([x, y]) => inside(image, x, y) && isOpaque(image, x, y)).map(([x, y]) => lightness(image, x, y)).sort((a, b) => a - b);
    const contrast = (skin.length === 0 ? 0 : skin[Math.floor(skin.length / 2)]!) - st.darkL;
    if (role !== "far" && contrast < EYE_TABLE_RULES.minContrast) findings.push({ check: "V3", message: `${role} 눈 대비 ${contrast.toFixed(2)} < ${EYE_TABLE_RULES.minContrast}` });
  }
  if (!stalk) {
    const layout = layoutIssue(entry);
    if (layout) findings.push({ check: "V4", message: layout });
  }
  // V5: 상자 밖 두 칸 안의 어두운 칸 중 눈동자와 4방향으로 이어진 것만 센다(입·무늬 선은 떨어져 있어 빠진다)
  const isDark = (x: number, y: number) => inside(image, x, y) && isOpaque(image, x, y) && lightness(image, x, y) < EYE_TABLE_RULES.darkL;
  const reached = new Set<number>();
  const stack: [number, number][] = [];
  for (const { box } of all) for (let y = box[1]; y < box[1] + box[3]; y += 1) for (let x = box[0]; x < box[0] + box[2]; x += 1) if (isDark(x, y)) stack.push([x, y]);
  let leftover = 0;
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + ox, ny = y + oy;
      if (reached.has(ny * image.width + nx) || all.some((p) => inBox(p.box, nx, ny)) || !all.some((p) => inBox(p.box, nx, ny, 2))) continue;
      if (!isDark(nx, ny) || isEdge(image, nx, ny)) continue;
      reached.add(ny * image.width + nx);
      leftover += 1;
      stack.push([nx, ny]);
    }
  }
  if (leftover > EYE_TABLE_RULES.maxLeftover) findings.push({ check: "V5", message: `눈 상자 밖으로 이어진 어두운 칸 ${leftover}개 — 옛 눈 잔상·윤곽 합쳐짐` });
  const styleIssue = styleProblem(image, entry);
  if (styleIssue) findings.push({ check: "V7", message: styleIssue });
  return findings;
}

function layoutIssue(entry: EyeEntry): string | null {
  const n = entry.near;
  if (entry.anatomy === "profile") return entry.far || entry.second ? "옆얼굴(profile)인데 둘째 눈이 있다" : null;
  if (entry.anatomy === "frontal") {
    const s = entry.second;
    if (!s) return "정면(frontal)인데 둘째 눈이 없다";
    if (Math.abs(s[2] * s[3] - n[2] * n[3]) > Math.max(n[2] * n[3], s[2] * s[3]) * 0.35 || Math.abs(s[1] - n[1]) > 1) return "정면 두 눈 크기·높이가 다르다";
    return null;
  }
  const f = entry.far;
  if (!f) return null;
  const gap = n[0] - (f[0] + f[2]);
  if (gap < 1 || gap > EYE_TABLE_RULES.maxFarGap) return `먼 눈과 가까운 눈 간격 ${gap} (1~${EYE_TABLE_RULES.maxFarGap})`;
  if (f[2] * f[3] > n[2] * n[3]) return "먼 눈이 가까운 눈보다 크다";
  if (Math.abs(f[1] + f[3] / 2 - (n[1] + n[3] / 2)) > EYE_TABLE_RULES.maxDy) return "먼 눈과 가까운 눈 높이가 어긋난다";
  return null;
}

function styleProblem(image: RgbaImage, entry: EyeEntry): string | null {
  if (entry.style === "square") return "사각 5×5 눈(폐지) — 둥근 틀로 바꿔야 한다";
  if (entry.style === "hand" || entry.style === "reference") return null;
  const [x, y, , h] = entry.near;
  if (entry.style === "round" && h < 6) return `둥근 틀인데 가까운 눈 높이 ${h} < 6`;
  if (h < 4) return `눈 높이 ${h} < 4 — 선으로 읽힌다`;
  // 6차 틀(눈썹·속눈썹 포함 상자)도 왼쪽 위 모서리는 살갗이다 — 꽉 찬 사각 덩어리 금지
  if (lightness(image, x, y) < EYE_TABLE_RULES.darkL) return "가까운 눈 왼쪽 위 모서리가 어둡다(사각으로 보인다)";
  return null;
}

/**
 * 진화 계통(evolvesFrom 사슬) 안에서 사각 틀(폐지)과 둥근 계열 틀이 섞였는지. 동결 기준종(reference)은 뺀다.
 * 6차부터 계통 안에서 틀이 아기 → 성체로 바뀌는 것(예: glossy → round → sharp)은 의도된 변화라 같은 갈래로 본다.
 */
export function checkLineStyles(table: EyeTable, species: readonly { id: string; evolvesFrom?: string }[]): Map<string, EyeFinding> {
  const parent = new Map(species.map((s) => [s.id, s.evolvesFrom]));
  const root = (id: string): string => { let cur = id; while (parent.get(cur)) cur = parent.get(cur)!; return cur; };
  const lines = new Map<string, string[]>();
  for (const s of species) lines.set(root(s.id), [...(lines.get(root(s.id)) ?? []), s.id]);
  const out = new Map<string, EyeFinding>();
  for (const members of lines.values()) {
    const fam = (id: string) => { const st = table.species[id]?.style; return st === "square" || st === "reference" ? st : "drawn"; };
    const styles = new Set(members.filter((id) => fam(id) !== "reference" && !table.species[id]?.pending).map(fam));
    if (styles.size <= 1) continue;
    for (const id of members) {
      if (fam(id) === "reference" || table.species[id]?.pending) continue;
      out.set(id, { check: "V7", message: `계통 ${members.join("→")} 안에서 눈 양식이 섞였다 (${[...styles].join(", ")})` });
    }
  }
  return out;
}

function isBox(v: unknown): v is EyeBox {
  return Array.isArray(v) && v.length === 4 && v.every((n) => Number.isInteger(n)) && v[0] >= 0 && v[1] >= 0 && v[2] >= 1 && v[3] >= 1 && v[0] + v[2] <= 64 && v[1] + v[3] <= 64;
}

/** eyes.json 을 읽어 형식을 확인한다. 시드의 모든 종이 있어야 한다. */
export function validateEyeTable(value: unknown, speciesIds: readonly string[]): EyeTable {
  const table = value as EyeTable;
  if (!table || table.version !== 1 || typeof table.species !== "object") throw new Error("eyes.json 형식이 아니다 (version 1, species)");
  for (const id of speciesIds) if (!table.species[id]) throw new Error(`eyes.json 에 ${id} 가 없다`);
  for (const [id, e] of Object.entries(table.species)) {
    if (!speciesIds.includes(id)) throw new Error(`eyes.json: 시드에 없는 종 ${id}`);
    if (!["threequarter", "profile", "frontal", "stalk"].includes(e.anatomy)) throw new Error(`eyes.json ${id}: anatomy ${e.anatomy}`);
    if (!(EYE_STYLES as readonly string[]).includes(e.style)) throw new Error(`eyes.json ${id}: style ${e.style}`);
    if (!isBox(e.near)) throw new Error(`eyes.json ${id}: near 상자`);
    if (e.far !== null && !isBox(e.far)) throw new Error(`eyes.json ${id}: far 는 상자 또는 null`);
    if (e.second !== undefined && !isBox(e.second)) throw new Error(`eyes.json ${id}: second 상자`);
    if ((e.anatomy === "frontal" || e.anatomy === "stalk") && !e.second) throw new Error(`eyes.json ${id}: ${e.anatomy} 는 second 가 필요하다`);
    for (const k of Object.keys(e.accept ?? {})) if (!(EYE_CHECK_IDS as readonly string[]).includes(k)) throw new Error(`eyes.json ${id}: accept 키 ${k}`);
  }
  return table;
}

/**
 * ObjectSpec v1 — 기물(맵 오브젝트) 하나의 설명서. tile-gen · 에셋 스토어 · 에디터가 같이 읽는 단일 정본이다(2026-10-20).
 *
 * - 정본 위치: 기물이 속한 타일셋의 구조 킷 `SectionStructureKitDef.spec`. 공방 굽기·tile-gen 팩이 여기에 쓴다.
 * - 스토어 팩 매니페스트 `content.objects[]` 는 이 킷들의 spec 에서 만들어진다(buildPack). 상품 화면의 「들어 있는 기물」.
 * - tile-gen(MovieHolic-Plex/tile-gen)의 `schema/objectspec.v1.schema.json` 과 같은 계약이다. 필드를 바꾸면 둘을 같이 고친다.
 *
 * 이 파일은 아무것도 import 하지 않는다 — 스토어 서버가 계약 파일로 바이트 그대로 복사해 쓴다(OpenRPGMaker-store CONTRACT.md).
 * 필드는 더하기만 한다(`oprn-object-spec/1` 이름 유지).
 * 위키: openwiki/object-spec.md
 */

export const OBJECT_SPEC_SCHEMA = "oprn-object-spec/1" as const;

/** 어디에 놓는 물건인가. floor 바닥 · wall 북쪽 벽 앞 · hang 벽면 걸이 · flat 밟는 바닥 무늬 · tabletop 탁자 위 · outdoor 야외 땅. */
export const OBJECT_SPEC_ANCHORS = ["floor", "wall", "hang", "flat", "tabletop", "outdoor"] as const;
export type ObjectSpecAnchor = (typeof OBJECT_SPEC_ANCHORS)[number];

export const OBJECT_SPEC_CATEGORIES = ["furniture", "prop", "building", "nature", "terrain", "vehicle", "sign", "light", "decor", "other"] as const;
export type ObjectSpecCategory = (typeof OBJECT_SPEC_CATEGORIES)[number];

/** 3/4 관문(object-gate)의 종류. src/harnesses/_core/objectGate/rules.ts 의 ObjectGateKind 와 같은 값(의존 없이 복사). */
export const OBJECT_SPEC_GATE_KINDS = [
  "tall_furniture", "low_furniture", "seat", "frame", "container", "round_body", "column", "box",
  "structure", "figure", "organic", "debris", "flat", "wall_mounted", "front_prop", "terrain", "other", "wall_structure",
] as const;
export type ObjectSpecGateKind = (typeof OBJECT_SPEC_GATE_KINDS)[number];

export const OBJECT_SPEC_GATE_VERDICTS = ["pass", "fail", "refer", "none"] as const;
export type ObjectSpecGateVerdict = (typeof OBJECT_SPEC_GATE_VERDICTS)[number];

/** 자주 쓰는 쓰임새(실내 방 짓기가 읽는다). 이 밖의 낱말도 받는다. */
export const OBJECT_SPEC_COMMON_USES = ["sit", "sleep", "storage", "work", "light", "decor"] as const;

/**
 * 통행 한 칸: `.` 밟고 지나감 · `X` 막힘 · `*` 캐릭터 위에 그려지며 지나감(★) · ` ` 빈 칸(그림 없음).
 * passage[y] 는 길이 size.w 인 문자열, passage.length === size.h.
 */
export const OBJECT_SPEC_PASSAGE_CHARS = ".X* " as const;

export const OBJECT_SPEC_LIMITS = {
  id: 80,
  name: 80,
  summary: 160,
  tags: 16,
  tagLength: 24,
  cells: 32,
  rule: 240,
  uses: 8,
  useLength: 24,
  text: 400,
} as const;

export interface ObjectSpecV1 {
  schema: typeof OBJECT_SPEC_SCHEMA;
  /** 타일셋 안에서 유일, 공백 없는 1~80자(예 `stone-well`, `workshop:돌-우물`). */
  id: string;
  /** 사람이 보는 이름(작가 언어). */
  name: string;
  /** 한 줄 소개(조수 목록·스토어 상세). */
  summary?: string;
  category: ObjectSpecCategory;
  /** 찾기 낱말·동의어. `hand:floor` 같은 인코딩 태그를 넣지 않는다 — 그 정보는 아래 칸에 있다. */
  tags: string[];
  /** 한 칸 픽셀(16). */
  tileSize: number;
  /** 칸 수. */
  size: { w: number; h: number };
  /** 시점: 발밑(막히는) 줄 수, 발밑 위로 솟은 픽셀(앉는 의자 등받이 겹침). */
  view: { footRows: number; risePx: number };
  /** 홈 레이어. */
  layer: "lower" | "upper" | "perCell";
  /** 칸별 통행(위 OBJECT_SPEC_PASSAGE_CHARS). 없으면 footRows 로 유도한다. */
  passage?: string[];
  placement: {
    anchor: ObjectSpecAnchor;
    use?: string[];
    /** 사람이 읽는 배치 문장(조수 프롬프트에 들어간다). */
    rule?: string;
    /** 가로로 이어 찍어도 되는가. */
    repeat?: "fixed" | "repeat";
  };
  /** 그림 신원. pixelSha256 = object-gate 정규화 화소 해시(영수증과 같은 정의). */
  art?: { pixelSha256?: string; gridHash?: string; tilesetId?: string; paletteId?: string };
  /** 3/4 관문 영수증 요약. 공개 스토어·번들은 verdict "pass" + 보정된 프로필만 효력이 있다(서버·굽기가 영수증 원본으로 다시 본다). */
  gate?: {
    kind: ObjectSpecGateKind;
    verdict: ObjectSpecGateVerdict;
    pixelSha256?: string;
    profileHash?: string;
    decidedAt?: string;
    /** 사람이 「그래도 넣기」를 누른 기록 — 자기 프로젝트(공방 로컬)에서만 효력. */
    override?: { by: "human"; at: string };
  };
  /** 적대 검수·사람 선택 기록. */
  review?: {
    vqa?: { verdict: "pass" | "fail" | "none"; judge?: string; calibrated: boolean; at?: string };
    pick?: { by: "human"; at: string; pixelSha256?: string };
  };
  /** 누가 어떻게 만들었나. AI 가 그렸으면 aiGenerated: true 를 숨길 수 없다. */
  provenance: { aiGenerated: boolean; tool?: string; drawModel?: string; agent?: string; brief?: string; /** 출발한 칩셋 기물(object-gen base-from-chipset) */ base?: string };
}

export type ObjectSpecValidation = { ok: true; value: ObjectSpecV1 } | { ok: false; errors: string[] };

/** 공백·제어 문자 없는 1~80자(공방 id 는 `workshop:돌-우물` 처럼 한글이 들어간다). */
const ID = /^[^\s\u0000-\u001f]{1,80}$/u;
const SHA256 = /^[0-9a-f]{64}$/;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown, max: number, min = 0): value is string => typeof value === "string" && value.length >= min && value.length <= max;
const isInt = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === "string" && (list as readonly string[]).includes(value);

/** 설명서 하나를 검사한다. 모르는 칸은 버리지 않고 그대로 둔다(더하기만 하는 계약이라 새 필드가 올 수 있다). */
export function validateObjectSpec(input: unknown): ObjectSpecValidation {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ["기물 설명서는 객체여야 합니다."] };
  const s = input;
  const where = typeof s.id === "string" ? s.id.slice(0, 40) : "?";
  const err = (text: string) => errors.push(`기물 ${where}: ${text}`);
  if (s.schema !== OBJECT_SPEC_SCHEMA) err(`schema 는 ${OBJECT_SPEC_SCHEMA} 여야 합니다.`);
  if (typeof s.id !== "string" || !ID.test(s.id) || ["__proto__", "constructor", "prototype"].includes(s.id)) err("id 는 공백 없는 1~80자여야 합니다.");
  if (!isText(s.name, OBJECT_SPEC_LIMITS.name, 1)) err(`이름은 1~${OBJECT_SPEC_LIMITS.name}자여야 합니다.`);
  if (s.summary !== undefined && !isText(s.summary, OBJECT_SPEC_LIMITS.summary)) err(`소개는 ${OBJECT_SPEC_LIMITS.summary}자 이하여야 합니다.`);
  if (!oneOf(OBJECT_SPEC_CATEGORIES, s.category)) err(`category 는 ${OBJECT_SPEC_CATEGORIES.join("|")} 중 하나여야 합니다.`);
  if (!Array.isArray(s.tags) || s.tags.length > OBJECT_SPEC_LIMITS.tags || !s.tags.every((tag) => isText(tag, OBJECT_SPEC_LIMITS.tagLength, 1))) {
    err(`태그는 ${OBJECT_SPEC_LIMITS.tags}개 이하, 각 1~${OBJECT_SPEC_LIMITS.tagLength}자여야 합니다.`);
  }
  if (!isInt(s.tileSize, 8, 64)) err("tileSize 는 8~64 정수여야 합니다.");
  const size = isRecord(s.size) ? s.size : null;
  const w = size && isInt(size.w, 1, OBJECT_SPEC_LIMITS.cells) ? size.w : 0;
  const h = size && isInt(size.h, 1, OBJECT_SPEC_LIMITS.cells) ? size.h : 0;
  if (!w || !h) err(`size 는 {w,h} 각 1~${OBJECT_SPEC_LIMITS.cells}칸이어야 합니다.`);
  const view = isRecord(s.view) ? s.view : null;
  if (!view || !isInt(view.footRows, 0, OBJECT_SPEC_LIMITS.cells) || (h && (view.footRows as number) > h) || !isInt(view.risePx, 0, 1024)) {
    err("view 는 {footRows: 0~높이, risePx: 0 이상 정수} 여야 합니다.");
  }
  if (!oneOf(["lower", "upper", "perCell"] as const, s.layer)) err("layer 는 lower|upper|perCell 이어야 합니다.");
  if (s.passage !== undefined) {
    const ok = Array.isArray(s.passage) && s.passage.length === h
      && s.passage.every((row) => typeof row === "string" && row.length === w && [...row].every((c) => OBJECT_SPEC_PASSAGE_CHARS.includes(c)));
    if (!ok) err(`passage 는 높이 ${h}줄, 줄마다 ${w}글자(. X * 빈칸)여야 합니다.`);
  }
  const placement = isRecord(s.placement) ? s.placement : null;
  if (!placement || !oneOf(OBJECT_SPEC_ANCHORS, placement.anchor)) err(`placement.anchor 는 ${OBJECT_SPEC_ANCHORS.join("|")} 중 하나여야 합니다.`);
  else {
    if (placement.use !== undefined && (!Array.isArray(placement.use) || placement.use.length > OBJECT_SPEC_LIMITS.uses || !placement.use.every((u) => isText(u, OBJECT_SPEC_LIMITS.useLength, 1)))) {
      err(`placement.use 는 ${OBJECT_SPEC_LIMITS.uses}개 이하 낱말이어야 합니다.`);
    }
    if (placement.rule !== undefined && !isText(placement.rule, OBJECT_SPEC_LIMITS.rule)) err(`placement.rule 은 ${OBJECT_SPEC_LIMITS.rule}자 이하여야 합니다.`);
    if (placement.repeat !== undefined && !oneOf(["fixed", "repeat"] as const, placement.repeat)) err("placement.repeat 는 fixed|repeat 이어야 합니다.");
  }
  if (s.art !== undefined) {
    const art = isRecord(s.art) ? s.art : null;
    if (!art || (art.pixelSha256 !== undefined && !(typeof art.pixelSha256 === "string" && SHA256.test(art.pixelSha256)))
      || (art.gridHash !== undefined && !isText(art.gridHash, 160)) || (art.tilesetId !== undefined && !isText(art.tilesetId, 160))
      || (art.paletteId !== undefined && !isText(art.paletteId, 160))) err("art 는 {pixelSha256(64자 hex)?, gridHash?, tilesetId?, paletteId?} 여야 합니다.");
  }
  if (s.gate !== undefined) {
    const gate = isRecord(s.gate) ? s.gate : null;
    if (!gate || !oneOf(OBJECT_SPEC_GATE_KINDS, gate.kind) || !oneOf(OBJECT_SPEC_GATE_VERDICTS, gate.verdict)) err("gate 는 {kind: 관문 종류, verdict: pass|fail|refer|none} 이 있어야 합니다.");
    else {
      if (gate.pixelSha256 !== undefined && !(typeof gate.pixelSha256 === "string" && SHA256.test(gate.pixelSha256))) err("gate.pixelSha256 은 64자 hex 여야 합니다.");
      if (gate.profileHash !== undefined && !isText(gate.profileHash, 64, 1)) err("gate.profileHash 가 올바르지 않습니다.");
      if (gate.decidedAt !== undefined && !isText(gate.decidedAt, 40, 1)) err("gate.decidedAt 이 올바르지 않습니다.");
      if (gate.override !== undefined && !(isRecord(gate.override) && gate.override.by === "human" && isText(gate.override.at, 40, 1))) err("gate.override 는 {by:\"human\", at} 이어야 합니다.");
    }
  }
  if (s.review !== undefined) {
    const review = isRecord(s.review) ? s.review : null;
    const vqa = review && isRecord(review.vqa) ? review.vqa : null;
    const pick = review && isRecord(review.pick) ? review.pick : null;
    if (!review || (review.vqa !== undefined && !(vqa && oneOf(["pass", "fail", "none"] as const, vqa.verdict) && typeof vqa.calibrated === "boolean"))
      || (review.pick !== undefined && !(pick && pick.by === "human" && isText(pick.at, 40, 1)))) err("review 는 {vqa?: {verdict, calibrated}, pick?: {by:\"human\", at}} 이어야 합니다.");
  }
  const prov = isRecord(s.provenance) ? s.provenance : null;
  if (!prov || typeof prov.aiGenerated !== "boolean") err("provenance.aiGenerated(참·거짓)가 있어야 합니다.");
  else for (const key of ["tool", "drawModel", "agent", "brief", "base"] as const) {
    if (prov[key] !== undefined && !isText(prov[key], OBJECT_SPEC_LIMITS.text)) err(`provenance.${key} 는 ${OBJECT_SPEC_LIMITS.text}자 이하여야 합니다.`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: s as unknown as ObjectSpecV1 };
}

/** passage 가 없을 때 칸별 통행을 유도한다: 발밑 줄은 X, 그 위는 *, flat 은 전부 `.`. */
export function objectSpecPassage(spec: Pick<ObjectSpecV1, "size" | "view" | "placement" | "passage">): string[] {
  if (spec.passage && spec.passage.length === spec.size.h) return [...spec.passage];
  const rows: string[] = [];
  for (let y = 0; y < spec.size.h; y++) {
    const ch = spec.placement.anchor === "flat" ? "." : spec.placement.anchor === "hang" ? "*" : y >= spec.size.h - spec.view.footRows ? "X" : "*";
    rows.push(ch.repeat(spec.size.w));
  }
  return rows;
}

/** 조수·스토어 목록에 쓰는 한 줄 요약(이름 · 크기 · 놓는 곳 · 쓰임 · 3/4). */
export function objectSpecOneLine(spec: ObjectSpecV1): string {
  const anchor: Record<ObjectSpecAnchor, string> = { floor: "바닥", wall: "벽 앞", hang: "벽 걸이", flat: "바닥 무늬", tabletop: "탁자 위", outdoor: "야외" };
  const bits = [`${spec.name} ${spec.size.w}×${spec.size.h}칸`, anchor[spec.placement.anchor]];
  if (spec.placement.use?.length) bits.push(spec.placement.use.join("·"));
  if (spec.gate) bits.push(`3/4 ${spec.gate.verdict}`);
  if (spec.provenance.aiGenerated) bits.push("AI 생성");
  return bits.join(" · ");
}

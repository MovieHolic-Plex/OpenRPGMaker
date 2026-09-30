// editor/tools/retroChoreographyTools.ts
// list_retro_choreographies: retro2003 측면 전투의 계약 도트 연출(직업 96+로스터, 몬스터)을 찾아 준다.
// 새 스킬은 여기서 고른 id 를 upsert_skill 의 retroChoreographyId 로 넣어 연출을 빌려 쓴다.
// read_retro_skill_guide: 기믹 어휘·직업 설계 규칙·설계 예시(assets/retroSkillMechanics.ts 의 RETRO_SKILL_DESIGN_GUIDE 하나가 정본).
// upsert_choreography / duplicate_choreography / list_fx_sheets: 프로젝트가 소유하는 연출 레코드(database.skillChoreographies, id chor_*)를
// 시트 조합으로 조립·복제·고친다. 기본 연출(번들 계약)은 읽기 전용이고, 고치려면 duplicate_choreography 로 프로젝트 레코드를 만든다.
// 색인·필터의 유일한 구현은 assets/retroSkillCatalog.ts 이고, 편집기 스킬 탭 선택기와 같은 것을 쓴다.

import {
  RETRO_CHOREOGRAPHY_FAMILIES, RETRO_ELEMENT_IDS, filterRetroChoreographies, nearbyRetroChoreographies, nearbyRetroFxSheets,
  projectRetroChoreographyEntries, resolveSkillChoreography, retroChoreographyEntries, retroClassSkill, retroFxSheetEntries, retroFxSheetMeta, searchRetroFxSheets,
} from "@/assets/retroSkillCatalog";
import { RETRO_SKILL_DESIGN_GUIDE } from "@/assets/retroSkillMechanics";
import { isRetroTintValue, RETRO_TINT_PRESETS } from "@/assets/retroChoreographyTints";
import { retroMonsterSkill } from "@/assets/retroMonsterSkills";
import { choreographyCloneBase, freshChoreographyId } from "@/assets/retroChoreographyClone";
import {
  SKILL_CHOREOGRAPHY_ANCHORS, SKILL_CHOREOGRAPHY_ID_PREFIX, SKILL_CHOREOGRAPHY_LAYER_LIMIT, SKILL_CHOREOGRAPHY_LIMIT,
  SKILL_CHOREOGRAPHY_MOTIONS, SKILL_CHOREOGRAPHY_RANGES, SKILL_CHOREOGRAPHY_WEIGHTS, normalizeSkillChoreographyRecord,
} from "@/project/skillChoreographyRecords";
import type { Project } from "@/project/types";
import type { SkillChoreographyLayer, SkillChoreographyRecord } from "@/project/types/database";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const MOTIONS = [...SKILL_CHOREOGRAPHY_MOTIONS];
const ANCHORS = [...SKILL_CHOREOGRAPHY_ANCHORS];
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 40;

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const listRetroChoreographies: ToolDefinition = {
  name: "list_retro_choreographies",
  description:
    "retro2003 측면 전투의 도트 연출(안무) 계약을 찾는다. 새 스킬·복제 스킬은 자기 연출이 없어 기본 베기/불꽃으로 보이므로, " +
    "여기서 어울리는 연출을 골라 upsert_skill 의 retroChoreographyId 에 그 id 를 넣어 빌려 쓴다(같은 이름·id 를 새로 만들 필요 없음). " +
    "필터를 모두 생략하면 종류별 개수만 돌려주니 motion/element/anchor/family/query 로 좁혀라. 기본 12건, limit 최대 40. " +
    "family: base(기본 12직업) actor people animal vehicles monster-party monster. motion 은 직업(dash-strike leap-strike blink-strike flurry spin cast shoot buff finisher)과 몬스터(lunge shoot cast breath stomp buff finisher) 두 벌. " +
    "anchor: user target allTargets allAllies screen projectile. element: fire ice thunder water earth wind holy dark(추정). " +
    "프로젝트가 upsert_choreography·duplicate_choreography 로 만든 연출(chor_*)도 함께 나오며 origin 으로 구분된다. " +
    "스킬 여러 개(직업 한 벌)를 만들기 전에 read_retro_skill_guide 로 설계 규칙을 먼저 읽는다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      motion: { type: "string", enum: MOTIONS, description: "동작 종류" },
      element: { type: "string", enum: [...RETRO_ELEMENT_IDS], description: "속성(계약 표기 또는 레이어 이름·설명에서 추정)" },
      anchor: { type: "string", enum: ANCHORS, description: "이 연출이 그림을 붙이는 자리(예: allTargets=적 전체에 터지는 광역)" },
      family: { type: "string", enum: [...RETRO_CHOREOGRAPHY_FAMILIES], description: "직업 계열 또는 monster" },
      classId: { type: "string", description: "특정 직업 id 의 연출만(예: class_knight)" },
      query: { type: "string", description: "id·이름·설명·레이어 키·직업 이름 낱말 검색(공백=AND). 예: '번개 낙뢰', 'slash 3'" },
      origin: { type: "string", enum: ["default", "project"], description: "default=번들 기본 연출(읽기 전용) · project=이 프로젝트가 만든 연출 레코드(chor_*). 생략=둘 다(프로젝트 것이 먼저)" },
      limit: { type: "integer", description: `돌려줄 최대 건수(기본 ${DEFAULT_LIMIT}, 최대 ${MAX_LIMIT})` },
      offset: { type: "integer", description: "건너뛸 건수(다음 쪽 보기)" },
    },
  },
  invalidArgsExample: { motion: "cast", element: "fire", limit: 8 },
  run(draft, args): ToolExecResult {
    const records = draft.database.skillChoreographies ?? [];
    const filter = {
      motion: text(args.motion), element: text(args.element), anchor: text(args.anchor),
      family: text(args.family), classId: text(args.classId), query: text(args.query), origin: text(args.origin),
    };
    const active = Object.values(filter).some((value) => value !== undefined);
    if (!active) {
      const entries = retroChoreographyEntries();
      const byMotion: Record<string, number> = {};
      const byFamily: Record<string, number> = {};
      for (const entry of entries) {
        byMotion[entry.motion] = (byMotion[entry.motion] ?? 0) + 1;
        byFamily[entry.family] = (byFamily[entry.family] ?? 0) + 1;
      }
      return {
        summary: `연출 기본 ${entries.length}건 + 프로젝트 ${records.length}건 — 필터(motion/element/anchor/family/query/origin)로 좁혀 다시 조회`,
        data: {
          total: entries.length, byMotion, byFamily, elements: RETRO_ELEMENT_IDS, anchors: ANCHORS,
          projectTotal: records.length, ...(records.length ? { projectIds: records.slice(0, 20).map((record) => record.id) } : {}),
        },
      };
    }
    const all = filterRetroChoreographies(filter, records);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(args.limit)) || DEFAULT_LIMIT));
    const offset = Math.max(0, Math.floor(Number(args.offset)) || 0);
    const page = all.slice(offset, offset + limit);
    return {
      summary: `연출 ${all.length}건 중 ${page.length}건${offset ? ` (${offset}번째부터)` : ""}`,
      data: {
        total: all.length,
        items: page.map((entry) => ({
          id: entry.id, origin: entry.origin, name: entry.name, kind: entry.kind, family: entry.family,
          ...(entry.className ? { className: entry.className } : {}),
          motion: entry.motion, ...(entry.element ? { element: entry.element } : {}),
          layers: entry.layerSummary, description: entry.description,
        })),
        ...(offset + limit < all.length ? { nextOffset: offset + limit } : {}),
      },
    };
  },
};

const readRetroSkillGuide: ToolDefinition = {
  name: "read_retro_skill_guide",
  description:
    "retro2003 스킬 설계 지침을 읽는다: 기믹 어휘(다단·범위·수식·HP 대가·흡수·상태·부활…)와 upsert_skill 필드 대응, 쓸 수 있는 기본 상태 id, " +
    "직업 설계 규칙(직업당 8개 중 순수 1타 2개 이하·기믹 4종 이상·필살기·이름이 약속한 효과), 새 스킬이 retroChoreographyId 로 연출을 빌리는 절차, 크로노 트리거/FF 풍 예시. " +
    "새 직업의 스킬 묶음이나 여러 스킬을 한꺼번에 만들기 전에 한 번 읽는다(고정 텍스트라 반복 호출하지 않는다).",
  mode: "read",
  parameters: { type: "object", properties: {} },
  run(): ToolExecResult {
    return { summary: "retro2003 스킬 설계 지침", data: { guide: RETRO_SKILL_DESIGN_GUIDE } };
  },
};

// ---- 연출 조립: 프로젝트 레코드(chor_*) ----

const SHEET_HINT = "list_fx_sheets 로 시트 키를 조회하세요";
const [SPEED_MIN, SPEED_MAX] = SKILL_CHOREOGRAPHY_RANGES.speed;

function fail(message: string, code: string): never {
  throw new ToolError(message, { code });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 범위를 넘는 숫자는 정규화가 조용히 깎으므로, 도구는 여기서 거부하고 허용 범위를 알려 준다. */
function checkRange(label: string, value: unknown, [min, max]: readonly [number, number]): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    fail(`${label} 는 ${min}~${max} 사이 숫자여야 합니다(받은 값 ${JSON.stringify(value)}).`, "invalid-choreography");
  }
  return value;
}

/** 색조로 받는 값 — 저장 정규화(skillChoreographyRecords tintValue)와 같은 집합. 복제한 층의 프리셋을 그대로 되돌려 보내도 통과한다. */
const TINT_HINT = `#rrggbb · 프리셋 ${RETRO_TINT_PRESETS.map((preset) => preset.id).join("·")} · original(층만 원본색)`;
/** upsert_choreography 의 clear — 이 필드들을 레코드에서 지운다(원래 값으로 되돌리기). */
const CLEARABLE = ["description", "speed", "weight", "tint", "screen", "tags"] as const;

function checkLayer(raw: unknown, index: number): SkillChoreographyLayer {
  const label = `layers[${index}]`;
  if (!isObject(raw)) fail(`${label} 는 {sheet, anchor} 객체여야 합니다. 예: {sheet:"fx_slash_a", anchor:"target"}`, "invalid-choreography");
  const sheet = text(raw.sheet);
  if (!sheet) fail(`${label}.sheet(이펙트 시트 키)가 필요합니다. ${SHEET_HINT}.`, "invalid-choreography");
  if (!retroFxSheetMeta(sheet)) {
    const near = nearbyRetroFxSheets(sheet).map((entry) => `${entry.key}(${entry.frames}프레임)`);
    fail(`${label}.sheet '${sheet}' 은(는) 없는 시트입니다${near.length ? ` — 비슷한 후보: ${near.join(", ")}` : ""}. ${SHEET_HINT}.`, "unknown-fx-sheet");
  }
  if (typeof raw.anchor !== "string" || !(ANCHORS as readonly string[]).includes(raw.anchor)) {
    fail(`${label}.anchor 는 ${ANCHORS.join(" · ")} 중 하나여야 합니다(받은 값 ${JSON.stringify(raw.anchor)}).`, "invalid-choreography");
  }
  const startMs = checkRange(`${label}.startMs`, raw.startMs, SKILL_CHOREOGRAPHY_RANGES.startMs);
  const scale = checkRange(`${label}.scale`, raw.scale, SKILL_CHOREOGRAPHY_RANGES.scale);
  const repeat = checkRange(`${label}.repeat`, raw.repeat, SKILL_CHOREOGRAPHY_RANGES.repeat);
  if (raw.onHit !== undefined && raw.onHit !== null && raw.onHit !== "first" && raw.onHit !== "each") {
    fail(`${label}.onHit 는 first(첫 타에만) 또는 each(타마다)여야 합니다(받은 값 ${JSON.stringify(raw.onHit)}).`, "invalid-choreography");
  }
  if (raw.tint !== undefined && raw.tint !== null && !isRetroTintValue(typeof raw.tint === "string" ? raw.tint.trim().toLowerCase() : raw.tint)) {
    fail(`${label}.tint 는 ${TINT_HINT} 중 하나여야 합니다(받은 값 ${JSON.stringify(raw.tint)}).`, "invalid-choreography");
  }
  return {
    sheet, anchor: raw.anchor as SkillChoreographyLayer["anchor"],
    ...(startMs !== undefined ? { startMs: Math.round(startMs) } : {}),
    ...(scale !== undefined ? { scale } : {}),
    ...(repeat !== undefined ? { repeat: Math.round(repeat) } : {}),
    ...(raw.onHit === "first" || raw.onHit === "each" ? { onHit: raw.onHit } : {}),
    ...(typeof raw.tint === "string" ? { tint: raw.tint.trim().toLowerCase() } : {}),
    ...(text(raw.se) ? { se: text(raw.se) } : {}),
  };
}

function checkLayers(raw: unknown): SkillChoreographyLayer[] {
  if (!Array.isArray(raw) || raw.length === 0) fail("layers 는 비어 있지 않은 배열이어야 합니다. 예: [{sheet:\"fx_slash_a\", anchor:\"target\"}]", "invalid-choreography");
  if (raw.length > SKILL_CHOREOGRAPHY_LAYER_LIMIT) fail(`layers 는 최대 ${SKILL_CHOREOGRAPHY_LAYER_LIMIT}개입니다(받은 ${raw.length}개).`, "invalid-choreography");
  return raw.map(checkLayer);
}

function defaultChoreographyExists(id: string): boolean {
  return Boolean(retroClassSkill(id) || retroMonsterSkill(id));
}

function requireChorId(label: string, raw: string): void {
  if (!raw.startsWith(SKILL_CHOREOGRAPHY_ID_PREFIX) || raw.length === SKILL_CHOREOGRAPHY_ID_PREFIX.length || !/^[A-Za-z0-9_\-]+$/.test(raw)) {
    fail(`${label} '${raw}' 은(는) chor_ 로 시작하는 영문·숫자·밑줄 id 여야 합니다. 예: chor_leap_thunder`, "invalid-choreography-id");
  }
  if (defaultChoreographyExists(raw)) fail(`${label} '${raw}' 은(는) 기본 연출 id 입니다. 기본 연출은 고칠 수 없으니 duplicate_choreography 로 chor_ 사본을 만드세요.`, "choreography-read-only");
}

function ensureRecords(draft: Project): SkillChoreographyRecord[] {
  return (draft.database.skillChoreographies ??= []);
}

function recordData(record: SkillChoreographyRecord) {
  return { ...record, layersSummary: projectRetroChoreographyEntries([record])[0]?.layerSummary };
}

const layerItemSchema = {
  type: "object",
  properties: {
    sheet: { type: "string", description: "이펙트 시트 키(list_fx_sheets). 예: fx_slash_a" },
    anchor: { type: "string", enum: ANCHORS, description: "붙는 자리. user=시전자 target=대상 allTargets=적 전체 allAllies=아군 전체 screen=화면 전체 projectile=날아가는 탄" },
    startMs: { type: "number", description: `이 층이 시작하는 ms(${SKILL_CHOREOGRAPHY_RANGES.startMs.join("~")}). 생략=동작의 기본 타이밍` },
    scale: { type: "number", description: `크기 배율(${SKILL_CHOREOGRAPHY_RANGES.scale.join("~")}). 생략=1` },
    repeat: { type: "integer", description: `연달아 반복(${SKILL_CHOREOGRAPHY_RANGES.repeat.join("~")}회). 생략=1` },
    onHit: { type: "string", enum: ["first", "each"], description: "each=다단 스킬에서 타마다 이 층이 터짐, first(기본)=첫 타에 한 번" },
    tint: { type: "string", description: "층 색조(선택): #rrggbb · 프리셋 id(fire ice thunder …) · original(이 층만 원본색)" },
    se: { type: "string", description: "층이 터질 때 효과음 id(선택)" },
  },
  required: ["sheet", "anchor"],
} as const;

const upsertChoreography: ToolDefinition = {
  name: "upsert_choreography",
  description:
    "retro2003 도트 연출(안무)을 이펙트 시트 조합으로 새로 조립하거나 고친다. 결과는 프로젝트 레코드 chor_<slug> 이고, " +
    "upsert_skill 의 retroChoreographyId 에 그 id 를 넣어 스킬에 붙인다. 기본 연출(skill_*)은 읽기 전용이라 고칠 수 없다 — 바꾸고 싶으면 duplicate_choreography 로 사본을 만든 뒤 여기서 고친다. " +
    "id 를 생략하면 name 으로 새로 만들고, 이미 있는 chor_ id 를 주면 준 필드만 덮어쓴다(layers 를 주면 층 전체를 교체). " +
    `motion: 직업 동작 dash-strike leap-strike blink-strike flurry spin cast shoot buff finisher, 몬스터 동작 lunge breath stomp(shoot cast buff finisher 는 공용). ` +
    `layers: 최대 ${SKILL_CHOREOGRAPHY_LAYER_LIMIT}층, 시트는 list_fx_sheets 로 고르고 모르는 키는 비슷한 후보와 함께 거부된다. ` +
    "층 옵션 startMs(늦게 시작) scale(크게) repeat(연타) onHit:each(다단 스킬에서 타마다 임팩트). 조립 순서는 read_retro_skill_guide 의 「연출 조립」.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "고칠 chor_ id(생략하면 새로 만든다)" },
      name: { type: "string", description: "연출 이름(새로 만들 때 필수)" },
      description: { type: "string", description: "한 줄 설명(선택)" },
      motion: { type: "string", enum: MOTIONS, description: "동작 종류(새로 만들 때 필수)" },
      layers: { type: "array", items: layerItemSchema, description: "이펙트 층 목록(새로 만들 때 필수). 주면 층 전체를 교체" },
      speed: { type: "number", description: `재생 속도 배율(${SPEED_MIN}~${SPEED_MAX}, 선택)` },
      weight: { type: "string", enum: [...SKILL_CHOREOGRAPHY_WEIGHTS], description: "무게감(선택)" },
      tint: { type: "string", description: "전체 색조(선택): #rrggbb 또는 프리셋 id(fire ice thunder …)" },
      screen: {
        type: "object",
        description: "화면 연출(선택). 주면 통째로 교체, {} 면 제거",
        properties: {
          shake: { type: "number", description: `화면 흔들림 세기(${SKILL_CHOREOGRAPHY_RANGES.shake.join("~")})` },
          flash: { type: "string", description: "#rrggbb 번쩍임 색" },
          dim: { type: "boolean", description: "true=연출 동안 화면 어둡게" },
          cutIn: { type: "boolean", description: "true=시전자 이름 컷인 띠" },
        },
      },
      tags: {
        type: "object",
        properties: { family: { type: "string", description: "분류 이름(선택)" }, element: { type: "string", enum: [...RETRO_ELEMENT_IDS], description: "속성(선택)" } },
      },
      clear: { type: "array", items: { type: "string", enum: [...CLEARABLE] }, description: "지울 필드 목록 — 색조·속도 등을 원래대로 되돌린다. 예: [\"tint\",\"speed\"]" },
    },
  },
  invalidArgsExample: { name: "도약 번개", motion: "leap-strike", layers: [{ sheet: "fx_slash_a", anchor: "target" }, { sheet: "fx_thunder_a", anchor: "target", startMs: 120, scale: 1.5 }] },
  run(draft, args): ToolExecResult {
    const records = ensureRecords(draft);
    const rawId = text(args.id);
    let existing: SkillChoreographyRecord | undefined;
    if (rawId) {
      requireChorId("id", rawId);
      existing = records.find((record) => record.id === rawId);
      if (!existing) {
        const near = records.map((record) => record.id).slice(0, 8);
        fail(`chor_ id '${rawId}' 레코드가 없습니다${near.length ? ` (현재 ${near.join(", ")})` : ""}. 새로 만들려면 id 를 생략하고 name 을 주세요.`, "choreography-not-found");
      }
    }
    const motion = args.motion === undefined ? existing?.motion : args.motion;
    if (typeof motion !== "string" || !SKILL_CHOREOGRAPHY_MOTIONS.includes(motion)) {
      fail(`motion 은 ${MOTIONS.join(" · ")} 중 하나여야 합니다(받은 값 ${JSON.stringify(motion)}).`, "invalid-choreography");
    }
    const layers = args.layers === undefined ? existing?.layers : checkLayers(args.layers);
    if (!layers) fail("새 연출에는 layers 가 필요합니다. 예: [{sheet:\"fx_slash_a\", anchor:\"target\"}]. list_fx_sheets 로 시트를 고르세요.", "invalid-choreography");
    const name = text(args.name) ?? existing?.name;
    if (!name) fail("새 연출에는 name 이 필요합니다.", "invalid-choreography");
    if (!existing && records.length >= SKILL_CHOREOGRAPHY_LIMIT) fail(`연출 레코드는 최대 ${SKILL_CHOREOGRAPHY_LIMIT}개입니다.`, "choreography-limit");
    const speed = checkRange("speed", args.speed, SKILL_CHOREOGRAPHY_RANGES.speed);
    if (args.weight !== undefined && !(SKILL_CHOREOGRAPHY_WEIGHTS as readonly unknown[]).includes(args.weight)) {
      fail(`weight 는 ${SKILL_CHOREOGRAPHY_WEIGHTS.join(" · ")} 중 하나여야 합니다.`, "invalid-choreography");
    }
    if (args.tint !== undefined && !(typeof args.tint === "string" && isRetroTintValue(args.tint.trim().toLowerCase()) && args.tint.trim().toLowerCase() !== "original")) {
      fail(`tint 는 #rrggbb 또는 프리셋 ${RETRO_TINT_PRESETS.map((preset) => preset.id).join("·")} 이어야 합니다. 색조를 없애려면 clear:["tint"].`, "invalid-choreography");
    }
    const clear = args.clear === undefined ? [] : args.clear;
    if (!Array.isArray(clear) || clear.some((key) => !(CLEARABLE as readonly unknown[]).includes(key))) {
      fail(`clear 는 ${CLEARABLE.join(" · ")} 중에서 고른 배열이어야 합니다(받은 값 ${JSON.stringify(args.clear)}).`, "invalid-choreography");
    }
    if (args.screen !== undefined && !isObject(args.screen)) fail("screen 은 {shake, flash, dim, cutIn} 객체여야 합니다.", "invalid-choreography");
    if (isObject(args.screen)) {
      checkRange("screen.shake", args.screen.shake, SKILL_CHOREOGRAPHY_RANGES.shake);
      if (args.screen.flash !== undefined && !(typeof args.screen.flash === "string" && /^#[0-9a-fA-F]{6}$/.test(args.screen.flash))) fail("screen.flash 는 #rrggbb 색이어야 합니다.", "invalid-choreography");
    }
    const tags = isObject(args.tags) ? { ...existing?.tags, ...(text(args.tags.family) ? { family: text(args.tags.family) } : {}), ...(text(args.tags.element) ? { element: text(args.tags.element) } : {}) } : existing?.tags;
    const draftRecord: Record<string, unknown> = {
      ...existing,
      id: existing?.id ?? freshChoreographyId(records, name),
      name, motion, layers,
      ...(text(args.description) ? { description: text(args.description) } : {}),
      ...(speed !== undefined ? { speed } : {}),
      ...(args.weight !== undefined ? { weight: args.weight } : {}),
      ...(typeof args.tint === "string" ? { tint: args.tint.trim().toLowerCase() } : {}),
      ...(isObject(args.screen) ? { screen: args.screen } : {}),
      ...(tags ? { tags } : {}),
    };
    for (const key of clear as readonly (typeof CLEARABLE)[number][]) delete draftRecord[key];
    const record = normalizeSkillChoreographyRecord(draftRecord);
    if (!record) fail("연출을 만들 수 없습니다: motion·layers 를 확인하세요.", "invalid-choreography");
    if (existing) records[records.indexOf(existing)] = record;
    else records.push(record);
    return {
      summary: `연출 '${record.name}'(${record.id}) ${existing ? "수정" : "추가"} — ${record.layers.length}층, 스킬에는 retroChoreographyId:"${record.id}" 로 붙인다`,
      data: recordData(record),
    };
  },
};

const duplicateChoreography: ToolDefinition = {
  name: "duplicate_choreography",
  description:
    "기본 연출(skill_* 계약) 또는 프로젝트 연출(chor_*)을 새 프로젝트 레코드 chor_<slug> 로 복제한다. 원본의 동작·층이 그대로 담기고 sourceId 에 원본 id 가 남는다. " +
    "기본 연출은 읽기 전용이라 조금만 바꾸고 싶을 때(층 하나 크게·늦게·타마다 등) 이걸로 사본을 만든 뒤 upsert_choreography 로 고친다. " +
    "원본 id 는 list_retro_choreographies 로 찾는다. id 를 생략하면 name(없으면 원본 id)으로 자동 지정.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      sourceId: { type: "string", description: "복제할 원본 연출 id(기본 skill_* 또는 프로젝트 chor_*)" },
      id: { type: "string", description: "새 chor_ id(생략=자동)" },
      name: { type: "string", description: "새 이름(생략=원본 이름 + ' 사본')" },
    },
    required: ["sourceId"],
  },
  invalidArgsExample: { sourceId: "skill_knight_slash", name: "내 기사 베기" },
  run(draft, args): ToolExecResult {
    const records = ensureRecords(draft);
    const sourceId = text(args.sourceId);
    if (!sourceId) fail("sourceId(복제할 연출 id)가 필요합니다. list_retro_choreographies 로 찾으세요.", "invalid-choreography");
    if (records.length >= SKILL_CHOREOGRAPHY_LIMIT) fail(`연출 레코드는 최대 ${SKILL_CHOREOGRAPHY_LIMIT}개입니다.`, "choreography-limit");
    const source = choreographyCloneBase(records, sourceId);
    if (!source) {
      const near = nearbyRetroChoreographies(sourceId, 5, records).map((row) => `${row.id}(${row.name}, ${row.motion})`);
      fail(`복제 원본 '${sourceId}' 을(를) 찾을 수 없습니다${near.length ? ` — 비슷한 후보: ${near.join(", ")}` : ""}. list_retro_choreographies 로 정확한 id 를 고르세요.`, "retro-choreography-not-found");
    }
    const { base, sourceName, fromProject } = source;
    const rawId = text(args.id);
    if (rawId) {
      requireChorId("id", rawId);
      if (records.some((record) => record.id === rawId)) fail(`id '${rawId}' 는 이미 있습니다. 고치려면 upsert_choreography 를 쓰세요.`, "choreography-exists");
    }
    const name = text(args.name) ?? `${sourceName} 사본`;
    const record = normalizeSkillChoreographyRecord({ ...base, id: rawId ?? freshChoreographyId(records, fromProject ? name : sourceId), name });
    if (!record) fail("복제한 연출이 유효하지 않습니다(층의 시트가 사라졌을 수 있음).", "invalid-choreography");
    records.push(record);
    return {
      summary: `연출 '${sourceName}'(${sourceId}) → '${record.name}'(${record.id}) 복제 — ${record.layers.length}층. 스킬에는 retroChoreographyId:"${record.id}" 로 붙이고, 고치려면 upsert_choreography`,
      data: recordData(record),
    };
  },
};

const FX_DEFAULT_LIMIT = 15;
const FX_MAX_LIMIT = 60;

const listFxSheets: ToolDefinition = {
  name: "list_fx_sheets",
  description:
    "upsert_choreography 의 layers[].sheet 로 쓸 수 있는 도트 이펙트 시트 키를 찾는다. 시트마다 frame(한 칸 픽셀)·frames(프레임 수)와 " +
    "usedBy(그 시트를 쓰는 기본 연출 수, 많을수록 검증된 모양)를 준다. query 는 한국어·영어 낱말(공백=AND): 예 '번개', '불꽃 폭발', 'slash', 'heal' — 속성 동의어(번개=thunder/bolt/lightning/chain)와 쓰는 스킬 이름까지 본다. " +
    `기본 ${FX_DEFAULT_LIMIT}건, limit 최대 ${FX_MAX_LIMIT}. 시트 키는 없는 것을 넣으면 upsert_choreography 가 거부한다. query 없이 부르면 개수만 돌려준다.`,
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "시트 검색(공백=AND, 한국어 가능). 예: '번개', 'thunder', 'slash 2'" },
      frame: { type: "integer", enum: [32, 64, 128], description: "한 칸 크기로 좁히기(32=작은 타격, 64=중간, 128=큰 광역)" },
      limit: { type: "integer", description: `돌려줄 최대 건수(기본 ${FX_DEFAULT_LIMIT}, 최대 ${FX_MAX_LIMIT})` },
      offset: { type: "integer", description: "건너뛸 건수(다음 쪽 보기)" },
    },
  },
  invalidArgsExample: { query: "thunder", limit: 10 },
  run(_draft, args): ToolExecResult {
    const query = text(args.query);
    const frame = typeof args.frame === "number" ? args.frame : undefined;
    if (!query && frame === undefined) {
      const all = retroFxSheetEntries();
      const byFrame: Record<string, number> = {};
      for (const sheet of all) byFrame[String(sheet.frame)] = (byFrame[String(sheet.frame)] ?? 0) + 1;
      return { summary: `이펙트 시트 ${all.length}장 — query(키 낱말)나 frame 으로 좁혀 다시 조회`, data: { total: all.length, byFrame } };
    }
    const all = searchRetroFxSheets(query)
      .filter((sheet) => frame === undefined || sheet.frame === frame)
      .sort((a, b) => b.usedBy - a.usedBy || a.key.localeCompare(b.key));
    const limit = Math.min(FX_MAX_LIMIT, Math.max(1, Math.floor(Number(args.limit)) || FX_DEFAULT_LIMIT));
    const offset = Math.max(0, Math.floor(Number(args.offset)) || 0);
    const page = all.slice(offset, offset + limit);
    return {
      summary: `이펙트 시트 ${all.length}장 중 ${page.length}장${offset ? ` (${offset}번째부터)` : ""}`,
      data: {
        total: all.length,
        items: page,
        ...(offset + limit < all.length ? { nextOffset: offset + limit } : {}),
      },
    };
  },
};

const previewChoreography: ToolDefinition = {
  name: "preview_choreography",
  description:
    "도트 연출 하나(기본 연출 id 또는 프로젝트 연출 chor_*)의 모습을 그림 한 장으로 본다. 층마다 한 줄, 그 시트의 프레임을 왼쪽에서 오른쪽(재생 순)으로 늘어놓고, " +
    "글로는 층 목록(시트·자리·시작 ms·배율·반복·프레임 수)을 준다. 시트를 골라 upsert_choreography 로 만든 뒤 결과를 확인하거나, 빌려 쓸 기본 연출이 정말 어울리는지 볼 때 쓴다. " +
    "그림은 실제 이미지 입력으로 전달된다(긴 변 768px 이하). id 는 list_retro_choreographies 가 준다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: { id: { type: "string", description: "연출 id(기본 연출 id 또는 chor_*)" } },
    required: ["id"],
  },
  invalidArgsExample: { id: "chor_thunder_chain" },
  run(draft, args): ToolExecResult {
    const id = text(args.id);
    if (!id) throw new ToolError("id 가 필요합니다 — list_retro_choreographies 로 찾으세요.");
    const records = draft.database.skillChoreographies ?? [];
    const resolved = resolveSkillChoreography({ id: `preview_${id}`, retroChoreographyId: id }, records);
    if (!resolved) throw new ToolError(`연출 '${id}' 를 찾을 수 없습니다 — list_retro_choreographies 로 id 를 확인하세요.`);
    const layers = resolved.skill.layers.map((layer, index) => ({
      index: index + 1, sheet: layer.key, anchor: layer.anchor, frame: layer.frame, frames: layer.frames,
      ...(layer.startMs !== undefined ? { startMs: layer.startMs } : {}),
      ...(layer.scale !== undefined ? { scale: layer.scale } : {}),
      ...(layer.repeat !== undefined ? { repeat: layer.repeat } : {}),
      ...(layer.onHit ? { onHit: true } : {}),
    }));
    return {
      summary: `연출 「${resolved.skill.name}」(${resolved.origin === "project" ? "프로젝트" : "기본"}, ${resolved.motion}) 층 ${layers.length}개 — 층별 프레임 그림을 확인하세요.`,
      data: { id: resolved.id, name: resolved.skill.name, origin: resolved.origin, kind: resolved.kind, motion: resolved.motion, layers },
    };
  },
};

export const RETRO_CHOREOGRAPHY_TOOLS: readonly ToolDefinition[] = [listRetroChoreographies, listFxSheets, upsertChoreography, duplicateChoreography, previewChoreography, readRetroSkillGuide];

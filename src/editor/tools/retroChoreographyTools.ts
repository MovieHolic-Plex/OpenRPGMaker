// editor/tools/retroChoreographyTools.ts
// list_retro_choreographies: retro2003 측면 전투의 계약 도트 연출(직업 96+로스터, 몬스터)을 찾아 준다.
// 새 스킬은 여기서 고른 id 를 upsert_skill 의 retroChoreographyId 로 넣어 연출을 빌려 쓴다.
// read_retro_skill_guide: 기믹 어휘·직업 설계 규칙·설계 예시(assets/retroSkillMechanics.ts 의 RETRO_SKILL_DESIGN_GUIDE 하나가 정본).
// 색인·필터의 유일한 구현은 assets/retroSkillCatalog.ts 이고, 편집기 스킬 탭 선택기와 같은 것을 쓴다.

import { RETRO_CHOREOGRAPHY_FAMILIES, RETRO_ELEMENT_IDS, filterRetroChoreographies, retroChoreographyEntries } from "@/assets/retroSkillCatalog";
import { RETRO_SKILL_DESIGN_GUIDE } from "@/assets/retroSkillMechanics";
import type { ToolDefinition, ToolExecResult } from "./types";

const MOTIONS = ["dash-strike", "leap-strike", "blink-strike", "flurry", "spin", "cast", "shoot", "buff", "finisher", "lunge", "breath", "stomp"];
const ANCHORS = ["user", "target", "allTargets", "allAllies", "screen", "projectile"];
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
      limit: { type: "integer", description: `돌려줄 최대 건수(기본 ${DEFAULT_LIMIT}, 최대 ${MAX_LIMIT})` },
      offset: { type: "integer", description: "건너뛸 건수(다음 쪽 보기)" },
    },
  },
  invalidArgsExample: { motion: "cast", element: "fire", limit: 8 },
  run(_draft, args): ToolExecResult {
    const filter = {
      motion: text(args.motion), element: text(args.element), anchor: text(args.anchor),
      family: text(args.family), classId: text(args.classId), query: text(args.query),
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
        summary: `연출 계약 ${entries.length}건 — 필터(motion/element/anchor/family/query)로 좁혀 다시 조회`,
        data: { total: entries.length, byMotion, byFamily, elements: RETRO_ELEMENT_IDS, anchors: ANCHORS },
      };
    }
    const all = filterRetroChoreographies(filter);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(args.limit)) || DEFAULT_LIMIT));
    const offset = Math.max(0, Math.floor(Number(args.offset)) || 0);
    const page = all.slice(offset, offset + limit);
    return {
      summary: `연출 ${all.length}건 중 ${page.length}건${offset ? ` (${offset}번째부터)` : ""}`,
      data: {
        total: all.length,
        items: page.map((entry) => ({
          id: entry.id, name: entry.name, kind: entry.kind, family: entry.family,
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

export const RETRO_CHOREOGRAPHY_TOOLS: readonly ToolDefinition[] = [listRetroChoreographies, readRetroSkillGuide];

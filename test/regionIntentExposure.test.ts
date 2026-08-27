// 라우터 가이드 ↔ 실제 도구 노출 정합 통합 테스트(2026-07-10 라이브 실측 수정).
//
// 결함 1(place_chest/mirror_region 등 라이브 실패)의 실제 원인은 카테고리별 "도메인 시드"
// 부족이 아니라(footer의 "현재 맵"이 map 도메인을 이미 항상 열고, quest-trigger는 가이드
// 문구의 "퀘스트"가 이미 quest 도메인을 연다 — A/B 실측으로 확인, 카테고리별 시드 병합은
// 죽은 복잡도라 되돌렸다) 아래 두 가지였다:
//  - regionIntentRouter의 structure/transform 가이드가 stamp_structure/clear_region을
//    안내했는데, 이 둘은 v1→v2→v3 폐기 체인으로 이미 deprecated라 도메인을 열어도 노출되지
//    않는다(toOpenAiTools가 deprecated는 무조건 제외). 가이드를 build_wall/tile_erase로 교정.
//  - 영역 작업 고정 문구("...적용된다")가 assistantToolMode.INTENT_KEYWORDS.battle.strong의
//    단음절 "적"과 부분일치해 매 턴 battle+database 도메인을 허위로 열고, 노출 상한(40)을
//    잠식해 mirror_region 등 map 도구가 크라우드아웃됐다. 문구를 "반영된다"로 교체.
//  - 상한(40) 슬라이스가 TOOL_REGISTRY 등록 순서를 그대로 슬라이스해 event/map 도메인의
//    후순위 정의(place_chest/set_scene_mood/create_transfer_pair/mirror_region/
//    set_encounter_table)가 밀려났다. PINNED_TOOLS_BY_DOMAIN에 추가해 항상 노출되게 했다.
//
// 아래 노출 단언은 모두 실제 buildRegionTaskMessage() 전체 산출물(축소 입력 아님)을
// computeActiveToolDomains에 통과시켜 검증한다. UI 모드는 실측과 동일하게 tile로
// 고정한다 — 헤드리스 기본값(map)에 얹혀 우연히 통과하는 것을 막기 위해서다.

import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { computeActiveToolDomains, resetAssistantToolDomainMemory } from "@/editor/assistantToolMode";
import { editorState } from "@/editor/editorState";
import { getTool, toOpenAiTools } from "@/editor/tools";
import {
  regionIntentGuideLines,
  routeRegionIntent,
  type RegionIntentCategory,
} from "@/editor/regionTask/regionIntentRouter";
import { buildRegionTaskMessage } from "@/editor/regionTask/runRegionTask";
import { el } from "@/util/dom";
import { installFakeDom } from "./fakeDom";

const ALL_CATEGORIES: readonly RegionIntentCategory[] = [
  "interior", "structure", "npc-shop", "door-transfer", "quest-trigger", "battle-trap", "mood", "transform",
];

// 대표 지시문 — 각각 정확히 해당 카테고리를 라우팅하는 문장.
const REPRESENTATIVE_INSTRUCTIONS: Readonly<Record<RegionIntentCategory, string>> = {
  interior: "연금술사의 집 이라는 실내 를 하나 만드렁줘",
  structure: "여기에 여관을 짓고 밭도 만들어줘",
  "npc-shop": "여기에 상인 NPC를 배치해줘",
  "door-transfer": "다음 맵으로 이어지는 텔레포트를 놔줘",
  "quest-trigger": "보물상자를 숨겨줘",
  "battle-trap": "슬라임 인카운터 구역으로 만들어줘",
  mood: "어둡고 음산한 조명으로 바꿔줘",
  transform: "좌우 대칭으로 만들어줘",
};

// 카테고리별로 노출 상한(40)과 무관하게 "항상" 노출이 보장돼야 하는 가이드 핵심 도구
// (PINNED_TOOLS_BY_DOMAIN에 등재된 것들 — 팀 리드가 지정한 5종 포함). 상한이 걸린
// 다도메인 조합에서는 이 목록 밖의 부차적 가이드 도구(예: place_trap, move_event)까지
// 전부 보장하지는 못한다 — 별도의 상한 알고리즘 개선이 필요한 사전 존재 이슈로 남겨둔다.
const GUARANTEED_TOOLS_BY_CATEGORY: Readonly<Record<RegionIntentCategory, readonly string[]>> = {
  interior: ["start_interior_room_session", "run_interior_room_pipeline", "advance_interior_room_build", "evaluate_interior_room"],
  // build_house_kit/build_house_lots는 CONSTRUCTION_WRITE_SUPERSEDED로 deprecated라 도메인을
  // 열어도 절대 노출되지 않는다(toOpenAiTools가 deprecated를 무조건 제외) → canonical 대체
  // 툴인 author_house로 검증한다. 가이드 문구도 author_house를 안내한다.
  structure: ["author_house", "build_wall", "fill_region", "create_farm_plot"],
  "npc-shop": ["place_npc", "make_villager"],
  "door-transfer": ["create_transfer_pair", "place_door"],
  "quest-trigger": ["place_chest", "place_storage_chest", "place_savepoint"],
  "battle-trap": ["set_encounter_table", "make_hunting_ground"],
  mood: ["set_scene_mood", "set_lighting_volume", "place_props"],
  transform: ["mirror_region", "tile_erase"],
};

// 가이드 문장에서 snake_case 도구명 후보를 뽑는다. 도구명이 아닌 snake_case 표기(인자
// 이름 등)가 가이드에 섞이면 여기 등록해 전수 검증에서 예외 처리한다.
const GUIDE_TEXT_NON_TOOL_WHITELIST: ReadonlySet<string> = new Set();
const SNAKE_CASE_RE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;
function toolNameCandidatesInGuide(category: RegionIntentCategory): string[] {
  const text = regionIntentGuideLines([category]).join("\n");
  return [...new Set(text.match(SNAKE_CASE_RE) ?? [])];
}

// 실측과 동일한 UI 모드(tile): 좌측 팔레트 보임 + layer=lower.
function forceTileUiMode(): void {
  document.body.append(el("div", { dataset: { testid: "left-palette-root" } }));
  editorState.set({ layer: "lower", tool: "paint" });
}

function exposedNamesFor(instruction: string): Set<string> {
  const message = buildRegionTaskMessage(instruction, "맵", "m1", { x: 0, y: 0, width: 4, height: 4 });
  const domains = computeActiveToolDomains(message);
  return new Set(toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name));
}

describe("regionIntentRouter ↔ 도구 노출 정합", () => {
  const restores: (() => void)[] = [];

  beforeEach(() => {
    restores.push(installFakeDom());
    forceTileUiMode();
    resetAssistantToolDomainMemory();
  });

  afterEach(() => {
    while (restores.length > 0) restores.pop()?.();
    resetAssistantToolDomainMemory();
  });

  // 전수(全數) 검증: 가이드 문장에서 뽑은 snake_case 후보는 (화이트리스트 예외를 빼면)
  // 전부 실존하는 도구명이어야 하고, 실존한다면 폐기(deprecated)되지 않아야 한다.
  // 앞선 버전은 실존하지 않는 후보를 조용히 걸러내(filter) 가이드 오탈자(예: 도구명을
  // 잘못 적은 경우)를 놓칠 수 있었다 — 이제 화이트리스트에 없는 미등록 후보는 그 자체로
  // 테스트 실패다. 상한(40)에 걸려 노출이 밀리는 것과 달리, deprecated 도구는 도메인을
  // 열어도 절대 노출되지 않는다 — 가이드가 이런 도구를 가리키면 항상 unknown tool이 된다
  // (structure의 stamp_structure, transform의 clear_region이 실제로 이 함정에 걸려 있었다).
  for (const category of ALL_CATEGORIES) {
    it(`${category} 가이드가 언급하는 snake_case 후보는 모두 실존 도구이고 폐기되지 않았다`, () => {
      const candidates = toolNameCandidatesInGuide(category);
      expect(candidates.length, `${category} 가이드에서 snake_case 후보를 하나도 못 찾음`).toBeGreaterThan(0);
      for (const name of candidates) {
        if (GUIDE_TEXT_NON_TOOL_WHITELIST.has(name)) continue;
        const tool = getTool(name);
        expect(tool, `${category}: "${name}"은(는) 등록된 도구가 아니다(가이드 오탈자 의심) — 실제 도구명이면 화이트리스트에 추가하라`).toBeDefined();
        expect(tool?.deprecated, `${category}: ${name}은(는) deprecated — supersededBy=${tool?.supersededBy}`).not.toBe(true);
      }
    });
  }

  it.each(ALL_CATEGORIES)(
    "%s: 대표 지시문이 해당 카테고리로 라우팅되고, 상한과 무관하게 보장된 핵심 도구가 노출된다",
    (category) => {
      const instruction = REPRESENTATIVE_INSTRUCTIONS[category];
      const routed = routeRegionIntent(instruction);
      expect(routed, `routeRegionIntent("${instruction}")`).toContain(category);
      const exposed = exposedNamesFor(instruction);
      for (const toolName of GUARANTEED_TOOLS_BY_CATEGORY[category]) {
        expect(exposed.has(toolName), `${category}: ${toolName} (exposed=${[...exposed].sort().join(",")})`).toBe(true);
      }
    },
  );

  it("핵심 대표 도구 5종이 노출된다(팀 리드 지정 케이스)", () => {
    expect(exposedNamesFor("좌우 대칭으로 만들어줘").has("mirror_region")).toBe(true);
    expect(exposedNamesFor("보물상자를 숨겨줘").has("place_chest")).toBe(true);
    expect(exposedNamesFor("슬라임 인카운터 구역").has("set_encounter_table")).toBe(true);
    expect(exposedNamesFor("어둡고 음산한 조명").has("set_scene_mood")).toBe(true);
    expect(exposedNamesFor("다음 맵으로 이어지는 텔레포트").has("create_transfer_pair")).toBe(true);
  });
});

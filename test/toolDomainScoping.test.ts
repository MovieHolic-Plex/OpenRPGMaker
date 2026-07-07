// 컨텍스트 모드 툴 스코핑 T4 (2026-07-07 타일 시공 흐름 재설계 §2.2).
// - tile 모드: v3 프리미티브 + 코어만 노출(~12개), 옛 타일 지식 툴 0개.
// - event 모드: 이벤트 툴 포함, 타일 프리미티브 제외.
// - deprecated 는 어떤 모드에서도 노출되지 않는다.
// - 모드 판정은 UI 상태에서만 결정론으로 계산된다(원칙 0).

import { afterEach, describe, expect, it } from "vitest";
import { computeAssistantToolMode } from "@/editor/assistantToolMode";
import { editorState } from "@/editor/editorState";
import { allTools, toOpenAiTools, LEGACY_TILE_KNOWLEDGE_SUPERSEDED } from "@/editor/tools";
import { el } from "@/util/dom";
import { installFakeDom } from "./fakeDom";

const OLD_TILE_TOOLS = [...LEGACY_TILE_KNOWLEDGE_SUPERSEDED.keys()];
const V3_PRIMITIVES = ["build_wall", "build_roof", "place_door", "place_window", "lay_path", "place_props", "tile_erase"];
const CORE_TOOLS = ["create_map", "resize_map", "get_project_summary", "list_resources", "tile_query"];

function exposedNames(mode?: "tile" | "map" | "event" | "database"): Set<string> {
  return new Set(toOpenAiTools(undefined, mode ? { mode } : {}).map((tool) => tool.function.name));
}

describe("T4 — toOpenAiTools 모드 스코핑", () => {
  it("옛 타일 지식 툴 11종은 deprecated(비노출)이며 실행 호환(supersededBy)이 유지된다", () => {
    const byName = new Map(allTools().map((tool) => [tool.name, tool]));
    const exposed = exposedNames();
    for (const [name, replacement] of LEGACY_TILE_KNOWLEDGE_SUPERSEDED) {
      const tool = byName.get(name);
      expect(tool, name).toBeDefined();
      expect(tool!.deprecated, name).toBe(true);
      expect(tool!.supersededBy, name).toBe(replacement);
      expect(exposed.has(name), name).toBe(false);
    }
  });

  it("tile 모드: v3 프리미티브 + propose + 코어만 노출(~12개), 옛 타일 툴 0개", () => {
    const exposed = exposedNames("tile");
    for (const name of ["propose_tile_vocabulary", ...V3_PRIMITIVES, ...CORE_TOOLS]) {
      expect(exposed.has(name), name).toBe(true);
    }
    for (const name of OLD_TILE_TOOLS) expect(exposed.has(name), name).toBe(false);
    // 타 도메인 대군(이벤트/DB/세계관)은 tile 모드에서 보이지 않는다.
    for (const name of ["upsert_event", "place_npc", "upsert_item", "query_world", "create_quest"]) {
      expect(exposed.has(name), name).toBe(false);
    }
    // ~12개 스코프(코어 5 + 타일 9 + set_build_spec 제외 레지스트리 기준).
    expect(exposed.size).toBeGreaterThanOrEqual(12);
    expect(exposed.size).toBeLessThanOrEqual(16);
  });

  it("event 모드: 이벤트 툴 포함, 타일 프리미티브 제외, 코어는 상시", () => {
    const exposed = exposedNames("event");
    for (const name of ["upsert_event", "place_npc", "move_event", "find_events", "get_event", ...CORE_TOOLS]) {
      expect(exposed.has(name), name).toBe(true);
    }
    for (const name of V3_PRIMITIVES) expect(exposed.has(name), name).toBe(false);
  });

  it("deprecated 는 어떤 모드에서도 0개", () => {
    const deprecated = new Set(allTools().filter((tool) => tool.deprecated === true).map((tool) => tool.name));
    for (const mode of [undefined, "tile", "map", "event", "database"] as const) {
      const exposed = exposedNames(mode);
      for (const name of deprecated) expect(exposed.has(name), `${mode ?? "all"}:${name}`).toBe(false);
    }
  });

  it("mode 없으면 종전 동작(deprecated 만 제외한 전체 노출)", () => {
    const exposedCount = allTools().filter((tool) => tool.deprecated !== true).length;
    expect(toOpenAiTools().length).toBe(exposedCount);
  });
});

describe("T4 — computeAssistantToolMode (UI 상태 결정론)", () => {
  const restores: (() => void)[] = [];
  afterEach(() => {
    while (restores.length > 0) restores.pop()?.();
    editorState.set({ layer: "lower", tool: "paint" });
  });

  it("DOM 없음(헤드리스) → map (판정 불가 기본)", () => {
    expect(computeAssistantToolMode()).toBe("map");
  });

  it("좌측 타일 팔레트가 보이고 타일 레이어 편집 중이면 tile", () => {
    restores.push(installFakeDom());
    document.body.append(el("div", { dataset: { testid: "left-palette-root" } }));
    editorState.set({ layer: "lower", tool: "paint" });
    expect(computeAssistantToolMode()).toBe("tile");
  });

  it("이벤트 레이어/도구면 event, DB 모달이 열려 있으면 database 가 우선한다", () => {
    restores.push(installFakeDom());
    document.body.append(el("div", { dataset: { testid: "left-palette-root" } }));
    editorState.set({ layer: "event" });
    expect(computeAssistantToolMode()).toBe("event");
    document.body.append(el("div", { dataset: { testid: "database-modal" } }));
    expect(computeAssistantToolMode()).toBe("database");
  });
});

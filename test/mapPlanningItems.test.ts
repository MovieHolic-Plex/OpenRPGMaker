// 보존 기획 항목(OPRN-019) — 스키마·정규화·재사용 선택의 순수 계약.
//
// 여기서 잠그는 것:
//  1. 프로젝트 JSON 왕복(= 내보내기/가져오기 경로)에서 항목이 살아남는다.
//  2. 빈 목록은 필드를 지운다 — 옛 저장본의 바이트 안정성.
//  3. 잘못된 wire 데이터는 fail-closed 다(조용히 버리지 않는다).
//  4. 재사용 선택(none/all/selected)이 실제로 실릴 항목과 지침 블록을 정한다.
//  5. 은퇴·삭제된 항목은 선택에 남아 있어도 부활하지 않는다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import {
  activePlanningItems,
  describePlanningReuse,
  formatPlanningReuseBlock,
  makeMapPlanningItemId,
  MAP_PLANNING_ITEM_TEXT_MAX,
  normalizeMapPlanningItems,
  normalizePlanningItemText,
  planningTextFromSpecAsset,
  resolvePlanningReuse,
  type MapPlanningItem,
} from "@/project/mapPlanningItems";
import type { Project } from "@/project/types";

function withItems(items: MapPlanningItem[]): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("start map missing");
  map.planningItems = items;
  return project;
}

const item = (id: string, text: string, over: Partial<MapPlanningItem> = {}): MapPlanningItem => ({
  id,
  text,
  status: "active",
  origin: "user",
  ...over,
});

describe("보존 기획 항목 스키마", () => {
  it("프로젝트 JSON 왕복에서 항목이 그대로 살아남는다 (내보내기 → 가져오기)", () => {
    // Break: serialize 가 map 필드를 화이트리스트로 걸러 새 필드를 떨어뜨린다.
    const project = withItems([
      item("pi_1", "북쪽 광장은 남긴다", { createdAt: "2026-09-10T00:00:00.000Z" }),
      item("pi_2", "동쪽 부두는 밑그림에서 담았다", { origin: "spec", specAssetId: "map_1:dock", status: "retired" }),
    ]);
    const restored = deserialize(serialize(project));
    expect(restored.maps[restored.startMapId]?.planningItems).toEqual([
      item("pi_1", "북쪽 광장은 남긴다", { createdAt: "2026-09-10T00:00:00.000Z" }),
      item("pi_2", "동쪽 부두는 밑그림에서 담았다", { origin: "spec", specAssetId: "map_1:dock", status: "retired" }),
    ]);
  });

  it("항목이 없는 맵은 필드 자체가 없다 — 스키마 버전을 올리지 않는다", () => {
    // Break: 정규화가 빈 배열을 남겨 옛 프로젝트 JSON 의 바이트가 달라진다.
    const blank = deserialize(serialize(createBlankProject()));
    expect(blank.maps[blank.startMapId]?.planningItems).toBeUndefined();
    expect(blank.version).toBe(createBlankProject().version);
    const emptied = deserialize(serialize(withItems([])));
    expect(emptied.maps[emptied.startMapId]?.planningItems).toBeUndefined();
  });

  it("잘못된 wire 데이터는 load 를 실패시킨다 (조용한 삭제 금지)", () => {
    // Break: 셰이프 검사가 빠져 사용자가 보존한 문장이 이유 없이 사라진다.
    const cases: [string, unknown][] = [
      ["빈 본문", [{ id: "pi_1", text: "   ", status: "active", origin: "user" }]],
      ["없는 status", [{ id: "pi_1", text: "a", origin: "user" }]],
      ["알 수 없는 status", [{ id: "pi_1", text: "a", status: "archived", origin: "user" }]],
      ["알 수 없는 origin", [{ id: "pi_1", text: "a", status: "active", origin: "robot" }]],
      ["중복 id", [
        { id: "pi_1", text: "a", status: "active", origin: "user" },
        { id: "pi_1", text: "b", status: "active", origin: "user" },
      ]],
      ["배열이 아님", { id: "pi_1" }],
    ];
    for (const [label, value] of cases) {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("start map missing");
      (map as unknown as Record<string, unknown>).planningItems = value;
      expect(() => deserialize(serialize(project)), label).toThrow();
    }
  });

  it("정규화는 공백을 접고 상한을 지키며 알 수 없는 값을 기본값으로 되돌린다", () => {
    // Break: 본문 길이·중복·빈 목록 처리가 저장 경로와 도구 경로에서 갈라진다.
    expect(normalizePlanningItemText("  두   칸  ")).toBe("두 칸");
    expect(normalizePlanningItemText("가".repeat(MAP_PLANNING_ITEM_TEXT_MAX + 50)))
      .toHaveLength(MAP_PLANNING_ITEM_TEXT_MAX);
    expect(normalizeMapPlanningItems([])).toBeUndefined();
    expect(normalizeMapPlanningItems("nope")).toBeUndefined();
    expect(normalizeMapPlanningItems([{ id: "pi_1", text: "a", status: "weird", origin: "weird" }]))
      .toEqual([item("pi_1", "a")]);
    expect(makeMapPlanningItemId([item("pi_1", "a"), item("pi_2", "b")])).toBe("pi_3");
  });
});

describe("보존 기획 재사용 선택", () => {
  const items = [
    item("pi_1", "북쪽 광장은 남긴다"),
    item("pi_2", "동쪽 부두 유지"),
    item("pi_3", "옛 다리는 철거", { status: "retired" }),
  ];

  it("사용 안 함은 아무 항목도 아무 문장도 만들지 않는다", () => {
    // Break: 목록이 있다는 사실만으로 프롬프트에 문장이 실린다(숨은 강제 기억).
    const chosen = resolvePlanningReuse(items, { mode: "none", selectedIds: ["pi_1"] });
    expect(chosen).toEqual([]);
    expect(formatPlanningReuseBlock(chosen)).toBe("");
    expect(describePlanningReuse(0, "none")).toBe("보존 기획 사용 안 함");
  });

  it("전체는 은퇴 항목을 빼고 활성만 담는다", () => {
    // Break: 은퇴가 재사용 후보에서 빠지지 않아 「은퇴」와 「삭제」가 같은 뜻이 된다.
    const chosen = resolvePlanningReuse(items, { mode: "all", selectedIds: [] });
    expect(chosen.map((row) => row.id)).toEqual(["pi_1", "pi_2"]);
    expect(activePlanningItems(items)).toHaveLength(2);
  });

  it("선택은 고른 id 만 담고, 은퇴·없는 id 는 조용히 부활하지 않는다", () => {
    // Break: 삭제된 항목의 남은 선택이 다음 턴 지침으로 되살아난다.
    const chosen = resolvePlanningReuse(items, { mode: "selected", selectedIds: ["pi_2", "pi_3", "pi_없음"] });
    expect(chosen.map((row) => row.id)).toEqual(["pi_2"]);
  });

  it("지침 블록은 지침임을 본문에서 밝히고 항목을 번호로 싣는다", () => {
    // Break: 블록이 차단 규칙처럼 쓰여 조수가 새 요청을 거절하는 근거로 쓴다.
    const block = formatPlanningReuseBlock(resolvePlanningReuse(items, { mode: "all", selectedIds: [] }));
    expect(block).toContain("[보존 기획]");
    expect(block).toContain("지침이며 차단 규칙이 아니다");
    expect(block).toContain("1. 북쪽 광장은 남긴다");
    expect(block).toContain("2. 동쪽 부두 유지");
    expect(block).not.toContain("옛 다리는 철거");
  });

  it("밑그림 에셋은 좌표를 남긴 한 줄로 바뀐다", () => {
    // Break: 담은 항목이 좌표를 잃어 나중에 「원래 그 자리」를 판단할 수 없다.
    expect(planningTextFromSpecAsset({ id: "plaza", kind: "terrain", x: 4, y: 6, w: 8, h: 5, style: "석재 광장" }))
      .toBe("석재 광장 — terrain (4,6) 8×5");
    expect(planningTextFromSpecAsset({ id: "dock", kind: "road", x: 0, y: 0, w: 3, h: 2 }))
      .toBe("road — road (0,0) 3×2");
  });
});

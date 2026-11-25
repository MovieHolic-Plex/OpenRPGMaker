// 요약 카운터 **밖**의 변경이 사라지지 않는지 — 조수 검토 카드·영수증 카드가 읽는 어휘의 회귀.
//
// 왜 이 테스트가 있나 (실측 2026-09-14): 퀘스트·스토리 플래그·캐릭터·맵 연결·공통 이벤트처럼
// ChangeSummary 에 축이 없는 변경은 검토 카드에서 아무 흔적도 남기지 않았다 — 사용자는
// "적용/버리기" 만 있는 빈 카드로 결정해야 했다.
import { describe, expect, it } from "vitest";
import { AREA_LABELS, COUNTED_PROJECT_FIELDS, changedAreaLabels } from "@/project/changeAreas";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

function pair(mutate: (after: Project) => void): { before: Project; after: Project } {
  const before = createBlankProject();
  const after = structuredClone(before) as Project;
  mutate(after);
  return { before, after };
}

describe("changedAreaLabels", () => {
  it("카운터가 없는 영역의 변경을 사람 말로 남긴다", () => {
    const { before, after } = pair((project) => {
      project.meta = { ...project.meta, author: "다른 사람" };
      project.startPos = { x: 3, y: 4 };
      project.aiInstructions = "항상 한국어로 답한다";
    });
    // 라벨 표 순서 고정 — 사용자가 매번 같은 자리에서 같은 낱말을 읽는다.
    expect(changedAreaLabels(before, after)).toEqual(["프로젝트 정보", "AI 지시문", "시작 위치"]);
  });

  it("카운터가 이미 세는 영역은 입을 다문다 — 같은 사실을 두 번 말하지 않는다", () => {
    const { before, after } = pair((project) => {
      project.switches = [...project.switches, { id: "switch_1", name: "문 열림" }];
      project.variables = [...project.variables, { id: "var_1", name: "호감도" }];
      project.meta = { ...project.meta }; // 값이 같은 복사는 변경이 아니다.
    });
    expect(changedAreaLabels(before, after)).toEqual([]);
  });

  it("세계관은 엔티티 밖 변경만 이름으로 남긴다", () => {
    const withWorld = (relations: readonly unknown[]): Project => {
      const project = createBlankProject();
      project.world = { entities: [], relations: relations as never };
      return project;
    };
    const before = withWorld([]);

    const entitiesOnly = structuredClone(before) as Project;
    entitiesOnly.world = { entities: [{ id: "e1", name: "달" } as never], relations: [] };
    expect(changedAreaLabels(before, entitiesOnly)).toEqual([]);

    const relationsOnly = structuredClone(before) as Project;
    relationsOnly.world = { entities: [], relations: [{ id: "r1", from: "a", to: "b", kind: "ally" } as never] };
    expect(changedAreaLabels(before, relationsOnly)).toEqual(["세계관 관계"]);
  });

  it("아무것도 안 바뀌면 빈 배열", () => {
    const before = createBlankProject();
    expect(changedAreaLabels(before, structuredClone(before) as Project)).toEqual([]);
  });
});

describe("커버리지 — 새 필드는 조용히 사라질 수 없다", () => {
  // Project 인터페이스(src/project/types/project.ts)의 키 전량. 필드를 더하면 여기도 늘리고,
  // `COUNTED_PROJECT_FIELDS` 나 `AREA_LABELS` 중 하나에 **반드시** 넣어라. 둘 다 없으면 그 필드의
  // 변경은 검토 카드·영수증 어디에도 나타나지 않는다.
  const PROJECT_FIELDS = [
    "spatialAuthoring", "growth", "version", "meta", "assets", "resourceProfiles", "tilesets",
    "switches", "variables", "commonEvents", "database", "system", "session", "maps",
    "mapConnections", "villageInfoDocuments", "villageTemplates", "villagePresets",
    "defaultVillagePresetId", "aiDocuments", "aiInstructions", "worldCanon", "world", "worldGraph",
    "factions", "quests", "testPresets", "endings", "storyFlags", "characters", "charsetLabels",
    "audioDescriptions", "monsterMetadata", "mapTree", "startMapId", "startPos", "flags",
  ];

  it("모든 Project 키가 카운터에 있거나 라벨이 있다", () => {
    const uncovered = PROJECT_FIELDS.filter(
      (key) => COUNTED_PROJECT_FIELDS[key] !== true && AREA_LABELS[key] === undefined,
    );
    expect(uncovered).toEqual([]);
  });

  it("기본 프로젝트가 실제로 가진 키도 전부 덮인다", () => {
    const uncovered = Object.keys(createBlankProject()).filter(
      (key) => COUNTED_PROJECT_FIELDS[key] !== true && AREA_LABELS[key] === undefined,
    );
    expect(uncovered).toEqual([]);
  });

  it("라벨 표와 카운터 표는 겹치지 않는다 — 겹치면 어느 쪽도 보고하지 않는다", () => {
    const both = Object.keys(AREA_LABELS).filter((key) => COUNTED_PROJECT_FIELDS[key] === true);
    expect(both).toEqual([]);
  });
});

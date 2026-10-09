import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { PREFERENCE_PRECEDENCE_LINE, PREFERENCE_SECTION_HEADING } from "@/ai/preferenceMemory";
import { createBlankProject } from "@/project/defaults";

describe("buildSystemPrompt tileset knowledge", () => {
  it("includes the human label and executable meaning without exposing the private group id", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("missing start map");
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset) throw new Error("missing tileset");
    tileset.tileGroups = [...(tileset.tileGroups ?? []), {
      id: "user-cliff-private-id",
      name: "북쪽 반복 절벽",
      role: "wall",
      defaultLayer: "lower",
      layerHome: "lower",
      origin: "user",
      description: "2×3 단위를 이어 붙이는 절벽",
      placementRules: "가로와 세로 모두 반복 가능",
      tileIds: [0, 1, 30, 31, 60, 61],
      patternGrammar: {
        axis: "both",
        blockHeight: 3,
        blockWidth: 2,
        kind: "repeatable_block",
        minHeight: 3,
        minWidth: 2,
        parts: [{ role: "repeatBody", tileIds: [0, 1, 30, 31, 60, 61] }],
        preserveCaps: false,
        repeat: "source_order",
      },
    }];

    const context = buildSystemPrompt(project, { currentMapId: project.startMapId });

    expect(context).toContain("북쪽 반복 절벽");
    expect(context).toContain("pattern=repeatable_block");
    expect(context).toContain("shape=2x3");
    expect(context).toContain("passage=");
    expect(context).not.toContain("user-cliff-private-id");
  });
});

describe("buildSystemPrompt — 수정 vs 신규 라우팅", () => {
  it("기존 실내 맵 수정 경로를 신규 시공과 나눠 안내한다", () => {
    const project = createBlankProject();
    const context = buildSystemPrompt(project, { currentMapId: project.startMapId });

    expect(context).toContain("기존 실내 맵 수정");
    expect(context).toContain("furnish_interior_space");
    expect(context).toContain("list_interior_room_sessions");
    // 기존 맵 id 로 세션을 시작하면 그 맵이 삭제된다는 사실을 프롬프트에 박아 둔다.
    expect(context).toContain("map-exists");
    // 대상 선택 규칙이 라우팅보다 먼저 읽히도록 명시돼 있다.
    expect(context).toContain("대상 선택");
  });

  // 예산이 아무리 좁아도 "지금 보고 있는 맵이 무엇인가"는 남아야 한다 — 이것이 사라지면
  // "이/여기/지금"이 어느 맵인지 알 수 없어 모델이 새 맵을 만드는 쪽으로 기운다.
  it("현재 맵 요약은 예산 밖에 고정된다", () => {
    const project = createBlankProject();
    for (const budgetChars of [6000, 8000, 10000, 12000, 18000]) {
      const context = buildSystemPrompt(project, { currentMapId: project.startMapId, budgetChars });
      expect(context, `budget=${budgetChars}`).toContain("현재 맵 요약");
      expect(context, `budget=${budgetChars}`).toContain(project.startMapId);
    }
  });

  // 성향 블록도 같은 이유로 예산 밖이다 — 13,200자 슬라이싱이 이 블록을 먹으면
  // "AI 가 내 성향을 기억하지 못한다"가 프롬프트 층에서 그대로 재발한다.
  it("사람 성향 블록은 예산을 극단적으로 줄여도 남는다", () => {
    const project = createBlankProject();
    const memorySection = [
      PREFERENCE_SECTION_HEADING,
      PREFERENCE_PRECEDENCE_LINE,
      "- [강함] 마을 규모는 집 4채 이하로 작게 유지한다",
    ].join("\n");
    for (const budgetChars of [500, 1000, 6000, 18000]) {
      const context = buildSystemPrompt(project, {
        currentMapId: project.startMapId,
        budgetChars,
        preferenceMemorySection: memorySection,
      });
      expect(context, `budget=${budgetChars}`).toContain(PREFERENCE_SECTION_HEADING);
      expect(context, `budget=${budgetChars}`).toContain(PREFERENCE_PRECEDENCE_LINE);
      expect(context, `budget=${budgetChars}`).toContain("집 4채 이하");
    }
  });

  it("성향 블록을 넘기지 않으면 프롬프트에 성향 자리가 생기지 않는다", () => {
    const project = createBlankProject();
    const context = buildSystemPrompt(project, { currentMapId: project.startMapId });
    expect(context).not.toContain(PREFERENCE_SECTION_HEADING);
  });

  it("성향 블록은 서론 바로 뒤 고정 영역에 들어간다 — 능력 색인과 같은 자리", () => {
    const project = createBlankProject();
    const context = buildSystemPrompt(project, {
      currentMapId: project.startMapId,
      budgetChars: 800,
      preferenceMemorySection: PREFERENCE_SECTION_HEADING,
    });
    // 프로젝트 요약보다 먼저 읽힌다(예산 슬라이싱 대상 앞).
    expect(context.indexOf(PREFERENCE_SECTION_HEADING)).toBeLessThan(context.indexOf("현재 맵 요약"));
  });
});

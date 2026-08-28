// test/agentToolFollowups.test.ts
//
// 2026-08-28 실측(project oprn-4f65d09fb1, "음 다른맵을 더 만들자")에서 같이 드러난 결함들:
//  - evaluate_game_quality 가 맵 **개수만** 세어 잔디 단색 맵 2장을 통과시켰다.
//  - create_transfer_pair 가 3연속 실패했는데 안내는 원인과 무관하게 "주변 구조물·통행 지형 확인"이었다.
//  - place_npc 가 kind:"dialogue" 로 한 번 튕겨 라운드를 낭비했다.
import { describe, expect, it } from "vitest";
import { resolveCommandKind } from "@/editor/tools/eventCompile";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { Project } from "@/project/types";

function ctxWithMap(mapId: string, name = "숲길", size = 8): { project: Project } {
  const ctx = { project: createEmptyToolProject() };
  const result = runTool(ctx, "create_map", { id: mapId, name, width: size, height: size }, { dryRun: false });
  expect(result.ok).toBe(true);
  return ctx;
}

type QualityData = {
  verdict: { blocked: boolean };
  coverage: { content: { emptyMaps: number } };
};

const emptyMapIssueFor = (
  result: { issues?: readonly { code: string; mapId?: string; severity: string }[] },
  mapId: string,
) =>
  result.issues?.find((issue) => issue.code === "empty-map" && issue.mapId === mapId);

describe("evaluate_game_quality — 빈 맵 감지", () => {
  /** 시작 맵 + 저작 중 만든 빈 맵. 실측 상황(마을 프로젝트에 잔디밭이 추가됨)과 같은 모양. */
  function ctxWithStartAndEmptyMap(): { project: Project } {
    const ctx = ctxWithMap("m_start", "마을");
    ctx.project.maps.m_start!.lowerTiles[0] = TILE.PATH; // 시작 맵은 저작된 상태로 둔다
    expect(runTool(ctx, "create_map", { id: "m_field", name: "숲길", width: 8, height: 8 }, { dryRun: false }).ok).toBe(true);
    return ctx;
  }

  it("저작 중 만든 빈 맵을 차단 오류로 올리고 개수를 보고한다", () => {
    const result = runTool(ctxWithStartAndEmptyMap(), "evaluate_game_quality", {}, { dryRun: true });

    expect(result.ok).toBe(true);
    const data = result.data as QualityData;
    expect(data.coverage.content.emptyMaps).toBe(1);
    expect(data.verdict.blocked).toBe(true);
    expect(result.summary).toContain("빈 맵");
    expect(emptyMapIssueFor(result, "m_field")?.severity).toBe("error");
  });

  it("시작 맵만 비어 있는 새 프로젝트는 차단하지 않는다(warning)", () => {
    const ctx = { project: createBlankProject() };
    const startMapId = ctx.project.startMapId;
    const result = runTool(ctx, "evaluate_game_quality", {}, { dryRun: true });

    expect(emptyMapIssueFor(result, startMapId)?.severity).toBe("warning");
    expect((result.data as QualityData).verdict.blocked).toBe(false);
  });

  it("지형을 칠하면 빈 맵 오류가 사라진다", () => {
    const ctx = ctxWithStartAndEmptyMap();
    ctx.project.maps.m_field!.lowerTiles[0] = TILE.PATH;
    const result = runTool(ctx, "evaluate_game_quality", {}, { dryRun: true });

    expect(emptyMapIssueFor(result, "m_field")).toBeUndefined();
    expect((result.data as QualityData).coverage.content.emptyMaps).toBe(0);
    expect((result.data as QualityData).verdict.blocked).toBe(false);
  });
});

describe("create_transfer_pair — 실패 원인별 안내", () => {
  it("맵 밖 좌표는 맵 크기를 알려준다", () => {
    const ctx = ctxWithMap("m_a");
    runTool(ctx, "create_map", { id: "m_b", name: "여관", width: 8, height: 8 }, { dryRun: false });

    const result = runTool(
      ctx,
      "create_transfer_pair",
      { a: { mapId: "m_a", x: 99, y: 99 }, b: { mapId: "m_b", x: 4, y: 4 } },
      { dryRun: true },
    );

    expect(result.ok).toBe(false);
    const message = result.issues?.map((issue) => issue.message).join(" ") ?? result.summary;
    expect(message).toContain("A:");
    expect(message).toContain("맵 밖");
    expect(message).toContain("0..7");
    // 원인과 무관하던 종전 안내는 더 이상 나오지 않는다.
    expect(message).not.toContain("get_map_region으로 주변 구조물과 통행 지형을 확인");
  });

  it("실패한 쪽이 A/B 중 어디인지 짚는다", () => {
    const ctx = ctxWithMap("m_a");
    runTool(ctx, "create_map", { id: "m_b", name: "여관", width: 8, height: 8 }, { dryRun: false });

    const result = runTool(
      ctx,
      "create_transfer_pair",
      { a: { mapId: "m_a", x: 4, y: 4 }, b: { mapId: "m_b", x: -99, y: -99 } },
      { dryRun: true },
    );

    expect(result.ok).toBe(false);
    const message = result.issues?.map((issue) => issue.message).join(" ") ?? result.summary;
    expect(message).toContain("B:");
    expect(message).not.toContain("A:");
  });
});

describe("resolveCommandKind — 커맨드 kind 오표기 흡수", () => {
  it("정규 이름은 그대로 둔다", () => {
    expect(resolveCommandKind("text")).toBe("text");
    expect(resolveCommandKind("setSelfSwitch")).toBe("setSelfSwitch");
  });

  it("실측 오표기 dialogue 를 text 로 해석한다", () => {
    expect(resolveCommandKind("dialogue")).toBe("text");
  });

  it("구분자·대소문자만 다른 표기를 되돌린다", () => {
    expect(resolveCommandKind("change_gold")).toBe("changeGold");
    expect(resolveCommandKind("Change-Gold")).toBe("changeGold");
    expect(resolveCommandKind("TEXT")).toBe("text");
  });

  it("모르는 이름은 null 로 남겨 오류를 내게 한다", () => {
    expect(resolveCommandKind("teleportPlayerToTheMoon")).toBeNull();
    expect(resolveCommandKind("")).toBeNull();
  });
});

describe("place_npc — dialogue 표기로도 통과한다", () => {
  it("kind:\"dialogue\" 를 text 로 정규화해 배치가 성공한다", () => {
    const ctx = ctxWithMap("m_town", "마을", 12);
    const result = runTool(
      ctx,
      "place_npc",
      {
        mapId: "m_town",
        name: "상점 주인",
        x: 5,
        y: 5,
        pages: [{ commands: [{ kind: "dialogue", body: "어서 오세요" }] }],
      },
      { dryRun: false },
    );

    expect(result.ok).toBe(true);
    const placed = ctx.project.maps.m_town!.events.at(-1);
    expect(placed?.pages?.[0]?.commands?.some((command) => command.kind === "text")).toBe(true);
  });
});

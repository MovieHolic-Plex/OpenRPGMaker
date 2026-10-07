// 밑그림(BuildSpec) 게이트 강화 — 2026-09-03 적대적 리뷰에서 확정한 결함의 회귀 테스트.
// 각 it 의 첫 줄 주석이 "이 테스트를 빨갛게 만드는 프로덕션 변경"(name the break)이다.
import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import {
  SPATIAL_BUILD_TOOLS,
  TILE_WRITE_TOOLS,
  affectedRegions,
  builtCellsInRegions,
  implicitSpecFromContext,
  normalizeBuildSpec,
  validateBuildSpec,
  type BuildSpec,
} from "@/ai/buildSpec";
import { formatMaterialLabelHint } from "@/ai/turnGuide";
import { buildRegionTaskMessage } from "@/editor/regionTask/runRegionTask";
import { getTool, runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types";
import { independentReviewPayload } from "./independentReviewFixture";
import { fixedDeclarer } from "./intentFixture";

type ChatResult = import("@/ai/llmClient").ChatResult;
const CONFIG = { authMode: "apiKey" as const, baseUrl: "x", model: "stub-model", apiKey: "sk", maxToolCalls: 12, maxTokens: 8192 };

function scriptedChat(steps: readonly ChatResult[]) {
  let index = 0;
  return async (_config: unknown, request: import("@/ai/llmClient").ChatRequest): Promise<ChatResult> => {
    // The independent reviewer is not part of these scripts — this file gates blueprints and
    // spec scope, not the review protocol. Approve it without consuming a writer step so the
    // steps stay a writer script. Until the review envelope stopped repeating the whole
    // project payload per map, even a blank project with one 20x20 map overflowed the
    // reviewer window, so reviews were refused before being sent and never reached here.
    const review = independentReviewPayload(request);
    if (review) {
      return { message: { role: "assistant", content: JSON.stringify({ revision: review.revision,
        verdict: "approved", summary: "스크립트 검수 승인", findings: [] }) }, finishReason: "stop" } as ChatResult;
    }
    if (index >= steps.length) throw new Error("scripted chat exhausted");
    return steps[index++];
  };
}
function toolCallMsg(name: string, args: unknown, id: string): ChatResult {
  return { message: { role: "assistant", content: null, tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" } as ChatResult;
}
function finalMsg(text: string): ChatResult {
  return { message: { role: "assistant", content: text, tool_calls: undefined }, finishReason: "stop" } as ChatResult;
}
function mkProject(width = 20, height = 20): Project {
  const ctx = { project: createBlankProject() };
  const created = runTool(ctx, "create_map", { id: "m1", name: "게이트", width, height });
  if (!created.ok) throw new Error(created.summary);
  return ctx.project;
}
function fillLower(map: GameMap, x0: number, y0: number, w: number, h: number, tile: number): void {
  for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) map.lowerTiles[y * map.width + x] = tile;
}
function countLower(map: GameMap, tile: number): number {
  let count = 0;
  for (const value of map.lowerTiles) if (value === tile) count += 1;
  return count;
}
type Ev = { name: string; ok: boolean; summary: string; issues: string };
function collect(events: Ev[]) {
  return (event: { type: string; name?: string; result?: { ok: boolean; summary: string; issues?: { message: string }[] } }) => {
    if (event.type === "tool_call" && event.name && event.result) {
      events.push({ name: event.name, ok: event.result.ok, summary: event.result.summary, issues: (event.result.issues ?? []).map((issue) => issue.message).join(" ") });
    }
  };
}
function errors(project: Project, spec: unknown): string[] {
  return validateBuildSpec(project, spec).filter((issue) => issue.severity === "error").map((issue) => issue.message);
}

describe("밑그림 좌표 정규화 — 게이트는 검증기가 받아준 값과 같은 숫자를 본다", () => {
  it("normalizeBuildSpec 은 숫자 문자열 좌표를 정수로 바꾸고 나머지 필드는 보존한다", () => {
    // break: 정규화가 없으면 x 는 문자열로 남는다.
    const raw = { mapId: "m1", assets: [{ id: "h", kind: "house", x: "2", y: "2", w: "4", h: "4", style: "plaster", shape: "rect" }] } as unknown as BuildSpec;
    const normalized = normalizeBuildSpec(raw);
    expect(normalized.assets[0]).toMatchObject({ id: "h", x: 2, y: 2, w: 4, h: 4, style: "plaster", shape: "rect" });
    expect(typeof normalized.assets[0].x).toBe("number");
  });

  it("문자열 좌표로 확정한 밑그림도 밑그림 밖 구조물 정리를 차단한다", async () => {
    // break: applyBuildSpec 이 원본 args 를 그대로 activeSpec 에 저장하면 "2"+"4"="24" 로 덮어 통과한다.
    const project = mkProject();
    fillLower(project.maps.m1, 12, 12, 4, 4, TILE.WALL);
    const chat = scriptedChat([
      toolCallMsg("set_build_spec", { mapId: "m1", assets: [{ id: "h", kind: "house", x: "2", y: "2", w: "4", h: "4" }] }, "c1"),
      toolCallMsg("clear_region", { mapId: "m1", x: 12, y: 12, w: 4, h: 4 }, "c2"),
      finalMsg("끝"),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat });
    const events: Ev[] = [];
    await session.sendUserMessage("집 지어줘", collect(events));
    expect(typeof session.getActiveSpec()?.assets[0].x).toBe("number");
    const clear = events.find((event) => event.name === "clear_region");
    expect(clear?.ok).toBe(false);
    expect(countLower(session.getProposedProject().maps.m1, TILE.WALL)).toBe(16);
  });
});

describe("기존 내용 보호는 밑그림 안에서도 — 기준선(사용자 맵)에 있던 것은 선언 없이 덮지 않는다", () => {
  it("밑그림 확정 뒤 사용자가 그 자리에 판 호수는 다음 턴의 채우기가 덮지 못한다", async () => {
    // break: 게이트가 커버된 칸의 기존 내용을 검사하지 않으면 fill_region 이 통과해 물 16칸이 사라진다.
    const project = mkProject();
    const chat = scriptedChat([
      toolCallMsg("set_build_spec", { mapId: "m1", assets: [{ id: "h", kind: "house", x: 2, y: 2, w: 6, h: 7 }] }, "c1"),
      finalMsg("밑그림을 잡았습니다. 이대로 진행할까요?"),
      toolCallMsg("fill_region", { mapId: "m1", rect: { x: 2, y: 2, w: 6, h: 7 }, material: "잔디" }, "c2"),
      finalMsg("깔았습니다"),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat, declareIntent: fixedDeclarer({ mode: "create" }) });
    await session.sendUserMessage("집 지어줘", () => {});
    const edited = structuredClone(session.getProposedProject());
    fillLower(edited.maps.m1, 3, 3, 4, 4, TILE.WATER);
    expect(session.syncBaselineFromStoreIfClean(edited)).toBe(true);
    const events: Ev[] = [];
    await session.sendUserMessage("계속해", collect(events));
    const fill = events.find((event) => event.name === "fill_region");
    expect(fill?.ok).toBe(false);
    expect(fill?.summary).toContain("기존 구조물 보호");
    expect(fill?.issues).toContain("confirmDestroy");
    expect(countLower(session.getProposedProject().maps.m1, TILE.WATER)).toBe(16);
  });

  it("이 세션이 밑그림 안에 지은 것은 같은 세션이 다시 손댈 수 있다", async () => {
    // break: 보호 판정을 기준선이 아니라 현재 초안으로 하면 자기 벽을 고치는 채우기가 막힌다.
    const project = mkProject();
    const chat = scriptedChat([
      toolCallMsg("set_build_spec", { mapId: "m1", assets: [{ id: "h", kind: "house", x: 2, y: 2, w: 6, h: 7 }] }, "c1"),
      toolCallMsg("build_wall", { mapId: "m1", rect: { x: 2, y: 4, w: 6, h: 5 }, material: "벽" }, "c2"),
      toolCallMsg("fill_region", { mapId: "m1", rect: { x: 2, y: 2, w: 6, h: 7 }, material: "잔디" }, "c3"),
      finalMsg("끝"),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat });
    const events: Ev[] = [];
    await session.sendUserMessage("집 지어줘", collect(events));
    expect(events.find((event) => event.name === "build_wall")?.ok).toBe(true);
    expect(events.find((event) => event.name === "fill_region")?.ok).toBe(true);
  });

  it("clear 에셋에 confirmDestroy 가 있으면 기존 구조물을 덮는 clear_region 이 통과한다", async () => {
    // break: 보호가 선언을 읽지 않으면 철거 의도를 밝힌 정리까지 막힌다.
    const project = mkProject();
    fillLower(project.maps.m1, 3, 3, 4, 4, TILE.WALL);
    const chat = scriptedChat([
      toolCallMsg("set_build_spec", { mapId: "m1", assets: [{ id: "c", kind: "clear", x: 2, y: 2, w: 6, h: 6, confirmDestroy: true }] }, "c1"),
      toolCallMsg("clear_region", { mapId: "m1", x: 2, y: 2, w: 6, h: 6 }, "c2"),
      finalMsg("끝"),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat });
    const events: Ev[] = [];
    await session.sendUserMessage("철거해줘", collect(events));
    expect(events.find((event) => event.name === "clear_region")?.ok).toBe(true);
    expect(countLower(session.getProposedProject().maps.m1, TILE.WALL)).toBe(0);
  });

  it("overExisting 을 선언한 배치 에셋 자리의 기존 구조물은 덮을 수 있다", async () => {
    // break: 배치 에셋의 overExisting 을 허가로 읽지 않으면 선언하고도 막힌다.
    const project = mkProject();
    fillLower(project.maps.m1, 3, 3, 4, 4, TILE.WALL);
    const chat = scriptedChat([
      toolCallMsg("set_build_spec", { mapId: "m1", assets: [{ id: "h", kind: "terrain", x: 2, y: 2, w: 6, h: 6, overExisting: "clear" }] }, "c1"),
      toolCallMsg("fill_region", { mapId: "m1", rect: { x: 2, y: 2, w: 6, h: 6 }, material: "잔디" }, "c2"),
      finalMsg("끝"),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat });
    const events: Ev[] = [];
    await session.sendUserMessage("잔디 깔아줘", collect(events));
    expect(events.find((event) => event.name === "fill_region")?.ok).toBe(true);
  });
});

describe("게이트 밖이던 타일 쓰기 툴도 기존 구조물 보호를 받는다", () => {
  it("TILE_WRITE_TOOLS 는 살아 있는 v3 시공 프리미티브를 포함하고 전부 레지스트리에 있다", () => {
    // break: 목록에서 tile_erase 를 빼면 아래 보호가 사라진다.
    for (const name of ["tile_erase", "place_props", "build_wall", "lay_path", "place_door", "place_window", "build_roof"]) {
      expect(TILE_WRITE_TOOLS.has(name), name).toBe(true);
    }
    for (const name of TILE_WRITE_TOOLS) expect(getTool(name), name).toBeDefined();
    for (const name of SPATIAL_BUILD_TOOLS) expect(getTool(name), name).toBeDefined();
  });

  it("tile_erase 가 밑그림 없이 기준선 구조물을 지우려 하면 차단되고 빈 땅 정리는 그대로 통과한다", async () => {
    // break: tile_erase 를 게이트 밖에 두면 벽 16칸이 선언 없이 사라진다.
    const project = mkProject();
    fillLower(project.maps.m1, 12, 12, 4, 4, TILE.WALL);
    const chat = scriptedChat([
      toolCallMsg("tile_erase", { mapId: "m1", rect: { x: 12, y: 12, w: 4, h: 4 } }, "c1"),
      toolCallMsg("tile_erase", { mapId: "m1", rect: { x: 2, y: 2, w: 4, h: 4 } }, "c2"),
      finalMsg("끝"),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat });
    const events: Ev[] = [];
    await session.sendUserMessage("정리해줘", collect(events));
    expect(events.map((event) => event.ok)).toEqual([false, true]);
    expect(events[0].summary).toContain("기존 구조물 보호");
    expect(events[0].issues).toContain("confirmDestroy");
    expect(countLower(session.getProposedProject().maps.m1, TILE.WALL)).toBe(16);
  });

  it("build_wall 은 빈 땅이면 밑그림 없이 통과하고(v3 soft-allow) 기존 구조물 위면 차단된다", async () => {
    // break: v3 프리미티브에 밑그림 필수를 걸면 첫 호출이 「밑그림 없음」으로 막힌다.
    const project = mkProject();
    fillLower(project.maps.m1, 12, 12, 4, 4, TILE.WALL);
    const chat = scriptedChat([
      toolCallMsg("build_wall", { mapId: "m1", rect: { x: 2, y: 2, w: 5, h: 4 }, material: "벽" }, "c1"),
      toolCallMsg("build_wall", { mapId: "m1", rect: { x: 12, y: 12, w: 5, h: 4 }, material: "벽" }, "c2"),
      finalMsg("끝"),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat });
    const events: Ev[] = [];
    await session.sendUserMessage("벽 세워줘", collect(events));
    expect(events.map((event) => event.ok)).toEqual([true, false]);
    expect(events[1].summary).toContain("기존 구조물 보호");
  });

  it("paint_tiles mode=fill 은 맵 전체를 영향 영역으로 본다", async () => {
    // break: 면적 0 폴백이면 홍수 채우기가 밑그림 밖 구조물을 지나며 통과한다.
    const project = mkProject();
    fillLower(project.maps.m1, 12, 12, 4, 4, TILE.WALL);
    const chat = scriptedChat([
      toolCallMsg("set_build_spec", { mapId: "m1", assets: [{ id: "h", kind: "house", x: 2, y: 2, w: 4, h: 4 }] }, "c1"),
      toolCallMsg("paint_tiles", { mapId: "m1", layer: "lower", mode: "fill", tile: TILE.SAND, from: { x: 15, y: 15 } }, "c2"),
      finalMsg("끝"),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat });
    const events: Ev[] = [];
    await session.sendUserMessage("모래 깔아줘", collect(events));
    expect(events.find((event) => event.name === "paint_tiles")?.ok).toBe(false);
  });

  it("affectedRegions 는 area·at·wallRect 를 읽는다", () => {
    // break: wrapper 키를 읽지 않으면 place_props 가 면적 0 으로 떨어져 보호 검사를 건너뛴다.
    expect(affectedRegions("place_props", { mapId: "m1", area: { x: 20, y: 2, w: 6, h: 6 }, material: "침엽수" })).toEqual([{ mapId: "m1", x: 20, y: 2, w: 6, h: 6 }]);
    expect(affectedRegions("place_door", { mapId: "m1", at: { x: 6, y: 8 }, material: "문" })).toEqual([{ mapId: "m1", x: 6, y: 8, w: 1, h: 1 }]);
    expect(affectedRegions("build_roof", { mapId: "m1", material: "붉은 기와", wallRect: { x: 4, y: 4, w: 6, h: 5 } })).toEqual([{ mapId: "m1", x: 4, y: 4, w: 6, h: 5 }]);
  });
});

describe("지어진 칸 판정은 잔디 리터럴이 아니라 타일셋 어휘(terrain 역할 + 통행 가능)다", () => {
  it("모래 바닥 맵에서 집·정리 밑그림은 정리 방침 없이 통과하고, 벽을 덮는 정리는 confirmDestroy 를 요구한다", () => {
    // break: lower !== GRASS 를 지어진 칸으로 세면 모래 400칸이 전부 구조물이 된다.
    const project = mkProject();
    fillLower(project.maps.m1, 0, 0, 20, 20, TILE.SAND);
    expect(errors(project, { mapId: "m1", assets: [{ id: "h", kind: "house", x: 2, y: 2, w: 6, h: 7 }] })).toEqual([]);
    expect(errors(project, { mapId: "m1", assets: [{ id: "c", kind: "clear", x: 2, y: 2, w: 6, h: 7 }] })).toEqual([]);
    fillLower(project.maps.m1, 3, 3, 4, 4, TILE.WALL);
    expect(errors(project, { mapId: "m1", assets: [{ id: "c", kind: "clear", x: 2, y: 2, w: 6, h: 7 }] }).join(" ")).toContain("confirmDestroy");
  });

  it("길(terrain·통행 가능) 옆에 붙인 집은 정리 방침 없이 통과한다", () => {
    // break: 길을 지어진 칸으로 세면 테두리 1칸 규칙이 길 옆 집을 거부한다.
    const project = mkProject();
    fillLower(project.maps.m1, 0, 10, 20, 1, TILE.PATH);
    expect(errors(project, { mapId: "m1", assets: [{ id: "house", kind: "house", x: 5, y: 4, w: 6, h: 6 }] })).toEqual([]);
  });

  it("사용자가 가장자리에 세운 벽은 보호되고, 생성된 WALL 테두리 링은 제외된다", () => {
    // break: 링을 무조건 제외하면 가장자리 벽 11칸이 선언 없이 지워진다.
    const project = mkProject();
    fillLower(project.maps.m1, 0, 2, 1, 11, TILE.WALL);
    expect(builtCellsInRegions(project.maps.m1, [{ mapId: "m1", x: 0, y: 2, w: 1, h: 11 }]).count).toBe(11);
    const bordered = mkProject();
    const map = bordered.maps.m1;
    for (let x = 0; x < map.width; x += 1) { map.lowerTiles[x] = TILE.WALL; map.lowerTiles[(map.height - 1) * map.width + x] = TILE.WALL; }
    for (let y = 0; y < map.height; y += 1) { map.lowerTiles[y * map.width] = TILE.WALL; map.lowerTiles[y * map.width + map.width - 1] = TILE.WALL; }
    expect(builtCellsInRegions(map, [{ mapId: "m1", x: 0, y: 0, w: map.width, h: map.height }]).count).toBe(0);
  });
});

describe("교차 규칙 — 타일을 쓰지 않는 에셋은 겹쳐도 교차가 아니다", () => {
  it("npc·event·transfer 는 길·집과 겹칠 수 있다", () => {
    // break: NON_TILE_ASSET_KINDS 를 overlapAllowed 에서 빼면 길 위 주민이 「교차」로 거부된다.
    const project = mkProject();
    expect(errors(project, { mapId: "m1", assets: [{ id: "road", kind: "road", x: 0, y: 10, w: 20, h: 2 }, { id: "npc1", kind: "npc", x: 5, y: 10, w: 1, h: 1 }] })).toEqual([]);
    expect(errors(project, { mapId: "m1", assets: [{ id: "house", kind: "house", x: 2, y: 2, w: 6, h: 7 }, { id: "door", kind: "transfer", x: 4, y: 8, w: 1, h: 1 }] })).toEqual([]);
    expect(errors(project, { mapId: "m1", assets: [{ id: "house", kind: "house", x: 2, y: 2, w: 6, h: 7 }, { id: "road", kind: "road", x: 4, y: 0, w: 1, h: 20 }] }).join(" ")).toContain("교차");
  });
});

describe("암묵 스펙 — 선택 영역", () => {
  it("실제 패널 footer(재료 힌트가 맵과 선택 사이)와 영역 작업 footer(힌트가 뒤)를 모두 파싱한다", () => {
    // break: `$` 앵커 정규식은 선택 영역 뒤나 앞에 다른 항목이 붙으면 null 을 낸다.
    const project = mkProject();
    const tileset = project.tilesets[project.maps.m1.tilesetId];
    const hint = formatMaterialLabelHint(tileset).replace(/^- /, "");
    const panelFooter = `[컨텍스트] ${["현재 맵: 게이트 (m1)", hint, "사용자 선택 영역: (2,2) 4×4"].join(" · ")}`;
    expect(implicitSpecFromContext(`여기 지어줘\n${panelFooter}`)).toMatchObject({ mapId: "m1", assets: [{ x: 2, y: 2, w: 4, h: 4 }] });
    const regionMessage = buildRegionTaskMessage("여기 정리해줘", "게이트", "m1", { x: 3, y: 4, width: 5, height: 6 }, tileset);
    expect(implicitSpecFromContext(regionMessage)).toMatchObject({ mapId: "m1", assets: [{ x: 3, y: 4, w: 5, h: 6 }] });
    expect(implicitSpecFromContext("[컨텍스트] 현재 맵: 마을 (동쪽) (m1) · 사용자 선택 영역: (1,1) 2×2")).toMatchObject({ mapId: "m1" });
    expect(implicitSpecFromContext("[컨텍스트] 현재 맵: 게이트 (m1)")).toBeNull();
  });

  it("선택 영역 암묵 스펙은 그 턴에만 유효하고 다음 턴의 activeSpec 으로 승격되지 않는다", async () => {
    // 밑그림 없음은 더 이상 차단 사유가 아니므로 두 번째 턴의 쓰기도 실행된다. 검증하는 것은
    // 승격이 일어나지 않는다는 사실 하나 — activeSpec 이 두 턴 뒤에도 null 이다.
    const project = mkProject();
    const turns = [
      [toolCallMsg("paint_tiles", { mapId: "m1", layer: "lower", mode: "rect", tile: TILE.SAND, from: { x: 10, y: 10 }, to: { x: 12, y: 12 } }, "c1"),
        finalMsg("깔았습니다")],
      [toolCallMsg("paint_tiles", { mapId: "m1", layer: "lower", mode: "rect", tile: TILE.SAND, from: { x: 15, y: 15 }, to: { x: 16, y: 16 } }, "c2"),
        finalMsg("깔았습니다")],
    ];
    let turn = 0;
    let step = 0;
    const chat = async (): Promise<ChatResult> => {
      const steps = turns[turn]!;
      return step < steps.length ? steps[step++]! : finalMsg("끝");
    };
    const session = new AssistantSession(project, { config: CONFIG, chat });
    const first: Ev[] = [];
    await session.sendUserMessage("여기 모래 깔아줘\n[컨텍스트] 현재 맵: 게이트 (m1) · 사용자 선택 영역: (2,2) 4×4", collect(first));
    expect(first[0]?.ok).toBe(true);
    expect(session.getActiveSpec()).toBeNull();
    turn = 1;
    step = 0;
    const second: Ev[] = [];
    await session.sendUserMessage("(15,15)에도 모래 깔아줘", collect(second));
    expect(second[0]?.ok).toBe(true);
    expect(session.getActiveSpec()).toBeNull();
  });

  it("사용자가 지목한 선택 영역 안의 기존 구조물은 그 턴의 쓰기가 고칠 수 있고, 선택 밖은 여전히 보호된다", async () => {
    // break: 선택 영역 에셋을 덮어쓰기 허가로 읽지 않으면 「이 방 가구 배치 고쳐줘」의 지우고 다시 놓기가 막힌다.
    const project = mkProject();
    fillLower(project.maps.m1, 2, 9, 6, 2, TILE.WALL);
    fillLower(project.maps.m1, 14, 14, 3, 3, TILE.WALL);
    const chat = scriptedChat([
      toolCallMsg("tile_erase", { mapId: "m1", rect: { x: 2, y: 9, w: 4, h: 2 } }, "c1"),
      toolCallMsg("tile_erase", { mapId: "m1", rect: { x: 14, y: 14, w: 3, h: 3 } }, "c2"),
      finalMsg("정리했습니다."),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat });
    const events: Ev[] = [];
    await session.sendUserMessage("이 방 가구 배치 좀 고쳐줘\n[컨텍스트] 현재 맵: 게이트 (m1) · 사용자 선택 영역: (2,2) 10×10", collect(events));
    expect(events.map((event) => event.ok)).toEqual([true, false]);
    expect(events[1].summary).toContain("기존 구조물 보호");
  });

  it("opts.scope 로 넘어온 선택 영역도 암묵 스펙이다", async () => {
    // break: footer 문장만 읽으면 패널이 구조화해 넘긴 scope 가 무시된다.
    const project = mkProject();
    const chat = scriptedChat([
      toolCallMsg("paint_tiles", { mapId: "m1", layer: "lower", mode: "rect", tile: TILE.SAND, from: { x: 3, y: 3 }, to: { x: 4, y: 4 } }, "c1"),
      finalMsg("깔았습니다"),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat });
    const events: Ev[] = [];
    await session.sendUserMessage("여기 모래 깔아줘", collect(events), undefined, { scope: { mapId: "m1", region: { x: 2, y: 2, width: 4, height: 4 } } });
    expect(events[0]?.ok).toBe(true);
  });
});

describe("질문으로 끝난 턴", () => {
  it("모델이 되묻고 끝낸 턴에서는 밑그림 NPC 를 자동 배치하지 않는다", async () => {
    // break: 자동 배치 분기에 질문·변경기대 가드가 없으면 「진행할까요?」 뒤에 NPC 가 맵에 들어간다.
    const project = mkProject();
    const chat = scriptedChat([
      toolCallMsg("set_build_spec", { mapId: "m1", title: "상인 배치안", assets: [{ id: "merchant", kind: "npc", x: 5, y: 5, w: 1, h: 1, style: "상인" }] }, "c1"),
      finalMsg("(5,5)에 상인을 두는 안입니다. 이 위치로 진행할까요?"),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat, declareIntent: fixedDeclarer({ mode: "question", needsPlan: false }) });
    const events: Ev[] = [];
    const result = await session.sendUserMessage("상인을 어디에 두면 좋을지 계획만 보여줘", collect(events));
    expect(events.some((event) => event.name === "place_npc")).toBe(false);
    expect(result.proposedCalls).toEqual([]);
    expect(session.getProposedProject().maps.m1.events).toEqual([]);
  });
});


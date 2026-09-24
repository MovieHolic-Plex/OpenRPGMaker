import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { characterSpriteX, characterSpriteY } from "@/player/characterDepth";
import { createBlankProject } from "@/project/defaults";
import {
  createMemoryCutsceneProject,
  MEMORY_CUTSCENE_MAP_ID,
  MEMORY_CUTSCENE_PICTURE_ID,
  MEMORY_CUTSCENE_PICTURE_RESOURCE_ID,
} from "./fixtures/memoryCutsceneFixture";

describe("script_cutscene + run_scene_test", () => {
  it("회상 컷신이 카메라 pan, 픽처 표시, 종료 후 입력 잠금 해제를 통과한다", () => {
    const project = createMemoryCutsceneProject();
    const result = runTool(
      { project },
      "run_scene_test",
      {
        mapId: MEMORY_CUTSCENE_MAP_ID,
        start: { x: 2, y: 2 },
        steps: [
          { kind: "interact" },
          {
            kind: "expect",
            cameraAt: { cx: characterSpriteX(4), cy: characterSpriteY(5), tolerance: 0.001 },
            pictureVisible: { id: MEMORY_CUTSCENE_PICTURE_ID, resourceId: MEMORY_CUTSCENE_PICTURE_RESOURCE_ID },
            cutsceneLocked: false,
          },
          { kind: "move", dir: "right" },
          { kind: "expect", playerAt: { x: 3, y: 2 } },
        ],
      }
    );

    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({
      ok: true,
      finalState: {
        mapId: MEMORY_CUTSCENE_MAP_ID,
        x: 3,
        y: 2,
        cutsceneLocked: false,
      },
    });
  });

  it("memory_opening 프리셋은 회상 스틸을 올리고 끝나면 입력을 돌려준다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const placed = runTool(ctx, "script_cutscene_preset", {
      mapId,
      preset: "memory_opening",
      eventId: "ev_recollect",
      x: 2,
      y: 3,
    });
    expect(placed.ok, placed.summary).toBe(true);
    const result = runTool(ctx, "run_scene_test", {
      mapId,
      start: { x: 2, y: 2 },
      steps: [
        { kind: "interact" },
        {
          kind: "expect",
          pictureVisible: { id: "pic_memory", resourceId: "easyrpg-picture-cloud" },
        },
        { kind: "interact" },
        { kind: "interact" },
        { kind: "expect", cutsceneLocked: false },
        { kind: "move", dir: "right" },
        { kind: "expect", playerAt: { x: 3, y: 2 } },
      ],
    });
    expect(result.ok, result.summary).toBe(true);
  });

  it("리소스 라벨 Decision1을 실제 효과음 id로 자동 해석한다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "script_cutscene", {
      mapId: ctx.project.startMapId,
      eventId: "ev_decision",
      x: 2,
      y: 2,
      beats: [
        { kind: "music", action: "se", resourceId: "Decision1" },
        { kind: "say", speaker: "수호석", text: "선택하라." },
      ],
    });

    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    const event = ctx.project.maps[ctx.project.startMapId]?.events.find((entry) => entry.id === "ev_decision");
    expect(event?.pages?.[0]?.commands).toContainEqual({
      kind: "playAudio",
      resourceId: "easyrpg-sound-decision1",
      loop: false,
    });
    expect(result.diff?.warnings.join("\n") ?? "").toContain("Decision1");
  });
});

describe("script_cutscene 진행 비트(switch · transfer · ending)와 requiresSwitches", () => {
  function memoryProject() {
    const ctx = { project: createBlankProject() };
    const startMapId = ctx.project.startMapId;
    const next = runTool(ctx, "create_map", { id: "map_memory_2", name: "두 번째 기억", width: 12, height: 10 });
    expect(next.ok, next.summary).toBe(true);
    const [memento, gateDone] = ctx.project.switches.slice(0, 2).map((entry) => entry.id);
    return { ctx, startMapId, memento: memento!, gateDone: gateDone! };
  }

  it("메멘토 스위치가 켜지면 자동 컷신이 페이드 → 다음 기억으로 옮기고 잠금을 푼다", () => {
    const { ctx, startMapId, memento, gateDone } = memoryProject();
    const examine = runTool(ctx, "script_cutscene", {
      mapId: startMapId, eventId: "ev_memento", x: 3, y: 2, trigger: "action",
      beats: [{ kind: "say", speaker: "노을", text: "오래된 턴테이블이에요." }, { kind: "switch", switchId: memento }],
    });
    expect(examine.ok, examine.summary).toBe(true);
    const gate = runTool(ctx, "script_cutscene", {
      mapId: startMapId, eventId: "ev_gate", x: 6, y: 6, trigger: "auto", once: true, skippable: true,
      requiresSwitches: [memento],
      beats: [
        { kind: "say", speaker: "서하온", text: "다음 기억으로 간다." },
        { kind: "fade", direction: "out", durationMs: 400, wait: true },
        { kind: "switch", switchId: gateDone },
        { kind: "transfer", mapId: "map_memory_2", x: 4, y: 4, facing: "up" },
        { kind: "fade", direction: "in", durationMs: 400, wait: true },
      ],
    });
    expect(gate.ok, gate.summary).toBe(true);
    const page = ctx.project.maps[startMapId]!.events.find((event) => event.id === "ev_gate")!.pages![0]!;
    expect(page.conditions).toEqual([
      { kind: "switch", switchId: memento, value: true },
      { kind: "selfSwitch", key: "A", value: false },
    ]);
    const result = runTool(ctx, "run_scene_test", {
      mapId: startMapId,
      start: { x: 2, y: 2 },
      steps: [
        { kind: "face", dir: "right" },
        { kind: "interact" },
        { kind: "expect", mapId: "map_memory_2", playerAt: { x: 4, y: 4 }, cutsceneLocked: false, switchOn: gateDone },
      ],
    });
    expect(result.ok, result.summary).toBe(true);
  });

  it("건너뛰기 착지 라벨 뒤에 스위치·이동·엔딩이 남는다 — Esc 로 건너뛰어도 진행이 빠지지 않는다", () => {
    const { ctx, startMapId, gateDone } = memoryProject();
    const ending = runTool(ctx, "define_ending", { id: "ending_song", name: "마지막 소절", conditions: [] });
    expect(ending.ok, ending.summary).toBe(true);
    const placed = runTool(ctx, "script_cutscene", {
      mapId: startMapId, eventId: "ev_final", x: 5, y: 5, trigger: "action", skippable: true,
      beats: [
        { kind: "say", speaker: "별", text: "언니, 노래 불러 줘." },
        { kind: "switch", switchId: gateDone },
        { kind: "transfer", mapId: "map_memory_2", x: 4, y: 4 },
        { kind: "say", speaker: "노을", text: "병실로 돌아왔어요." },
        { kind: "ending", endingId: "ending_song" },
      ],
    });
    expect(placed.ok, placed.summary).toBe(true);
    const commands = ctx.project.maps[startMapId]!.events.find((event) => event.id === "ev_final")!.pages![0]!.commands;
    const kinds = commands.map((command) => command.kind);
    const skipLanding = kinds.indexOf("label");
    expect(skipLanding).toBeGreaterThan(0);
    const afterLanding = kinds.slice(skipLanding);
    expect(afterLanding).toContain("setSwitch");
    expect(afterLanding).toContain("transfer");
    expect(kinds.at(-1)).toBe("triggerEnding");
    expect(kinds.filter((kind) => kind === "transfer")).toHaveLength(1);
  });

  it("없는 맵·스위치·엔딩을 가리키면 어느 비트인지 짚어 거부한다", () => {
    const { ctx, startMapId } = memoryProject();
    const bad = runTool(ctx, "script_cutscene", {
      mapId: startMapId, trigger: "action",
      beats: [{ kind: "switch", switchId: "sw_nope" }, { kind: "transfer", mapId: "map_nope", x: 1, y: 1 }, { kind: "ending", endingId: "ending_nope" }],
    });
    expect(bad.ok).toBe(false);
    expect(bad.summary).toContain("beats[0].switchId");
    expect(bad.summary).toContain("beats[1].mapId");
    expect(bad.summary).toContain("beats[2].endingId");
    const missingGate = runTool(ctx, "script_cutscene", { mapId: startMapId, trigger: "auto", requiresSwitches: ["sw_nope"], beats: [{ kind: "wait", ms: 200 }] });
    expect(missingGate.ok).toBe(false);
    expect(missingGate.summary).toContain("sw_nope");
  });
});

describe("script_cutscene_preset ending_fade", () => {
  it("엔딩 스위치를 켜고 실제로 엔딩을 부르며, 한 번만 재생된다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const placed = runTool(ctx, "script_cutscene_preset", {
      mapId, preset: "ending_fade", eventId: "ev_last", x: 4, y: 4, trigger: "action",
      speaker: "노을", lines: ["노래가 끝까지 이어졌어요."], endingId: "ending_song", endingName: "마지막 소절",
    });
    expect(placed.ok, placed.summary).toBe(true);
    const page = ctx.project.maps[mapId]!.events.find((event) => event.id === "ev_last")!.pages![0]!;
    const kinds = page.commands.map((command) => command.kind);
    expect(kinds).toContain("triggerEnding");
    expect(kinds).not.toContain("m2Command:camera");
    const result = runTool(ctx, "run_scene_test", {
      mapId, start: { x: 3, y: 4 },
      steps: [{ kind: "face", dir: "right" }, { kind: "interact" }, { kind: "expect", endingReached: "ending_song" }],
    });
    expect(result.ok, result.summary).toBe(true);
  });
});

describe("script_cutscene moveActor 경로 경고", () => {
  it("벽·맵 밖으로 걷는 이벤트 이동을 막힌 칸과 함께 경고한다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const npc = runTool(ctx, "place_npc", { mapId, name: "노을", x: 1, y: 1, lines: ["선배!"] });
    expect(npc.ok, npc.summary).toBe(true);
    const npcId = ctx.project.maps[mapId]!.events.find((event) => event.name === "노을")!.id;
    const placed = runTool(ctx, "script_cutscene", {
      mapId, trigger: "action", x: 5, y: 5,
      beats: [{ kind: "moveActor", target: npcId, moves: [{ kind: "move", dir: "up" }, { kind: "move", dir: "up" }, { kind: "move", dir: "up" }] }],
    });
    expect(placed.ok, placed.summary).toBe(true);
    const warnings = (placed.diff as { warnings?: string[] } | undefined)?.warnings ?? placed.warnings ?? [];
    expect(JSON.stringify(warnings)).toContain("컷신 이동 막힘");
  });
});

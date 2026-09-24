import { describe, expect, it } from "vitest";
import { compileCutscene, CutsceneValidationError, validateCutscene, type CutsceneBeat } from "@/editor/cutscene";

describe("compileCutscene", () => {
  it("대표 beat들을 이벤트 command 배열로 컴파일한다", () => {
    const beats: CutsceneBeat[] = [
      { kind: "say", speaker: "리나", face: { resourceId: "face_memory" }, text: "여기가 시작이었어." },
      { kind: "moveActor", target: "player", moves: [{ kind: "move", dir: "right" }], wait: true },
      { kind: "camera", mode: "pan", x: 5, y: 6, durationMs: 400, wait: true },
      { kind: "picture", action: "show", pictureId: "pic_memory", resourceId: "picture_memory", x: 10, y: 12 },
      { kind: "picture", action: "move", pictureId: "pic_memory", x: 24, y: 20, durationMs: 300, wait: true },
      { kind: "music", action: "bgm", resourceId: "bgm_memory" },
      { kind: "tint", value: "#101820", durationMs: 200, wait: true },
      { kind: "flash", color: "white", durationMs: 100 },
      { kind: "shake", intensity: 4, durationMs: 120 },
      { kind: "wait", ms: 80 },
    ];

    expect(compileCutscene(beats, { skippable: true })).toMatchInlineSnapshot(`
      [
        {
          "kind": "cutsceneControl",
          "mode": "begin",
          "skippable": true,
        },
        {
          "flipHorizontally": false,
          "kind": "changeFace",
          "position": "left",
          "resourceId": "face_memory",
        },
        {
          "body": "여기가 시작이었어.",
          "kind": "text",
          "speaker": "리나",
        },
        {
          "eventId": "@player",
          "kind": "moveEvent",
          "route": {
            "moves": [
              {
                "dir": "right",
                "kind": "move",
              },
            ],
            "repeat": false,
            "skippable": undefined,
            "wait": true,
          },
        },
        {
          "commandId": "m2-201-camera-control",
          "fields": {
            "durationMs": 400,
            "mode": "panTo",
            "target": "screen",
            "wait": true,
            "x": 5,
            "y": 6,
          },
          "kind": "m2Command",
        },
        {
          "kind": "showPicture",
          "pictureId": "pic_memory",
          "resourceId": "picture_memory",
          "x": 10,
          "y": 12,
        },
        {
          "commandId": "m2-052-move-picture",
          "fields": {
            "durationMs": 300,
            "pictureId": "pic_memory",
            "wait": true,
            "waitForPicture": true,
            "x": 24,
            "y": 20,
          },
          "kind": "m2Command",
        },
        {
          "kind": "playAudio",
          "loop": true,
          "resourceId": "bgm_memory",
        },
        {
          "commandId": "m2-046-tint-screen",
          "fields": {
            "color": "neutral",
            "durationMs": 200,
            "value": "#101820",
          },
          "kind": "m2Command",
        },
        {
          "kind": "wait",
          "ms": 200,
        },
        {
          "commandId": "m2-047-flash-screen",
          "fields": {
            "color": "white",
            "durationMs": 100,
          },
          "kind": "m2Command",
        },
        {
          "commandId": "m2-048-shake-screen",
          "fields": {
            "durationMs": 120,
            "intensity": 4,
          },
          "kind": "m2Command",
        },
        {
          "kind": "wait",
          "ms": 80,
        },
        {
          "kind": "label",
          "name": "cutscene_end",
        },
        {
          "commandId": "m2-201-camera-control",
          "fields": {
            "durationMs": 0,
            "mode": "panTo",
            "target": "screen",
            "wait": true,
            "x": 5,
            "y": 6,
          },
          "kind": "m2Command",
        },
        {
          "commandId": "m2-046-tint-screen",
          "fields": {
            "color": "neutral",
            "durationMs": 0,
            "value": "#101820",
          },
          "kind": "m2Command",
        },
        {
          "durationMs": 0,
          "kind": "showPicture",
          "pictureId": "pic_memory",
          "resourceId": "picture_memory",
          "waitForPicture": false,
          "x": 24,
          "y": 20,
        },
        {
          "kind": "cutsceneControl",
          "mode": "end",
        },
      ]
    `);
  });

  it("begin/end 쌍과 스킵 라벨을 항상 보장한다", () => {
    const commands = compileCutscene([{ kind: "jump", name: "after_line" }, { kind: "label", name: "after_line" }], { skippable: true });

    expect(commands[0]).toEqual({ kind: "cutsceneControl", mode: "begin", skippable: true });
    expect(commands.at(-1)).toEqual({ kind: "cutsceneControl", mode: "end" });
    expect(commands).toContainEqual({ kind: "label", name: "cutscene_end" });
    expect(commands).toContainEqual({ kind: "gotoLabel", name: "after_line" });
  });

  it("parallel beat는 이동 루트를 비대기로 만들고 마지막에 이동 완료 대기를 둔다", () => {
    const commands = compileCutscene([
      {
        kind: "parallel",
        beats: [
          { kind: "moveActor", target: "ev_friend", moves: [{ kind: "move", dir: "left" }], wait: true },
          { kind: "picture", action: "show", pictureId: "pic_parallel", resourceId: "picture_memory", x: 0, y: 0 },
        ],
      },
    ]);

    expect(commands).toContainEqual({
      kind: "moveEvent",
      eventId: "ev_friend",
      route: { moves: [{ kind: "move", dir: "left" }], repeat: false, wait: false, skippable: undefined },
    });
    expect(commands).toContainEqual({ kind: "m2Command", commandId: "m2-058-wait-for-all-movement", fields: {} });
  });

  it("검증기가 없는 이벤트, 픽처 id 충돌, 음수 duration을 한국어 사유로 거부한다", () => {
    const beats: CutsceneBeat[] = [
      { kind: "moveActor", target: "ev_missing", moves: [], wait: true },
      { kind: "picture", action: "show", pictureId: "pic1", resourceId: "picture_memory", x: 0, y: 0 },
      { kind: "picture", action: "show", pictureId: "pic1", resourceId: "picture_memory", x: 1, y: 1 },
      { kind: "wait", ms: -1 },
    ];
    const result = validateCutscene(beats, { eventIds: new Set(["ev_known"]) });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join("\n")).toContain("존재하지 않는 이벤트 'ev_missing'");
      expect(result.errors.join("\n")).toContain("픽처 id 'pic1'");
      expect(result.errors.join("\n")).toContain("duration은 음수일 수 없습니다");
    }
    expect(() => compileCutscene(beats, { context: { eventIds: new Set(["ev_known"]) } })).toThrow(CutsceneValidationError);
  });

  it("fade beat는 0.45 tint가 아닌 Screen Effect의 검정 fadeIn/fadeOut으로 컴파일한다", () => {
    const commands = compileCutscene([
      { kind: "fade", direction: "out", durationMs: 400, wait: true },
      { kind: "fade", direction: "in", durationMs: 400, wait: true },
    ]);
    expect(commands).toContainEqual(expect.objectContaining({
      kind: "m2Command",
      commandId: expect.stringMatching(/screen-effect/i),
      fields: expect.objectContaining({ effect: "fadeOut" }),
    }));
    expect(commands).toContainEqual(expect.objectContaining({
      kind: "m2Command",
      commandId: expect.stringMatching(/screen-effect/i),
      fields: expect.objectContaining({ effect: "fadeIn" }),
    }));
    expect(JSON.stringify(commands)).not.toContain("Tint Screen");
  });

  it("say beat의 emotion과 autoAdvance를 text command로 전달한다", () => {
    const commands = compileCutscene([
      { kind: "say", speaker: "리나", text: "기억나.", emotion: "sad", autoAdvance: true },
    ]);
    expect(commands).toContainEqual({
      kind: "text",
      speaker: "리나",
      body: "기억나.",
      emotion: "sad",
      autoAdvance: true,
    });
  });
});

/**
 * 카메라 줌이 AI 스키마에 노출되는가(2026-09-22).
 *
 * 왜 이 테스트가 필요한가: CutsceneCameraBeat.zoom 은 **컴파일러에 이미 있었지만**
 * CUTSCENE_BEAT_SCHEMA 에 없어서 모델이 그 필드의 존재를 알 수 없었다. 그래서
 * "고해상도 배경을 1:1로 쓰는" 요청에 모델이 배율을 걸 방법이 없었다. 스키마 노출과
 * 컴파일 결과를 함께 고정한다 — 둘 중 하나만 있으면 모델은 여전히 못 쓴다.
 */
describe("컷신 카메라 줌", () => {
  it("zoom 이 m2-201 camera-control 필드로 전달된다", () => {
    const commands = compileCutscene([
      { kind: "camera", mode: "fixed", target: "player", zoom: 4.5, durationMs: 0 },
    ]);
    const camera = commands.find((c) => c.kind === "m2Command" && c.commandId === "m2-201-camera-control");
    expect(camera).toBeDefined();
    expect((camera as { fields: Record<string, unknown> }).fields.zoom).toBe(4.5);
  });

  it("zoom 을 생략하면 필드가 비어 런타임 기본(1)을 따른다", () => {
    const commands = compileCutscene([{ kind: "camera", mode: "fixed", target: "player" }]);
    const camera = commands.find((c) => c.kind === "m2Command" && c.commandId === "m2-201-camera-control");
    expect((camera as { fields: Record<string, unknown> }).fields.zoom).toBeUndefined();
  });
});

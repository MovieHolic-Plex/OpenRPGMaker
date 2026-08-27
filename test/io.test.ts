// test/io.test.ts
// 직렬화/역직렬화 왕복 + 잘못된 파일 거부.

import { describe, it, expect } from "vitest";
import { serialize, deserialize, ProjectFormatError } from "@/project/io";
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";

describe("serialize → deserialize 왕복", () => {
  it("빈 프로젝트가 동일하게 복원된다", () => {
    const p = createBlankProject();
    const restored = deserialize(serialize(p));
    expect(serialize(restored)).toBe(serialize(p));
  });

  it("중첩 choices 명령이 보존된다", () => {
    const p = createBlankProject();
    const map = p.maps[p.startMapId];
    const nested: Command = {
      kind: "choices",
      prompt: "어디로?",
      options: [
        {
          text: "동굴",
          branch: [
            { kind: "text", speaker: "나", body: "어두운 동굴이다." },
            { kind: "setFlag", flag: "entered_cave", value: true },
          ],
        },
        {
          text: "돌아간다",
          branch: [{ kind: "text", body: "역시 돌아갔다." }],
        },
      ],
    };
    map.events = [
      {
        id: "ev1",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [nested],
      },
    ];
    const restored = deserialize(serialize(p));
    expect(restored.maps[p.startMapId].events[0].commands[0]).toEqual(nested);
  });
});

describe("deserialize 거부", () => {
  it("JSON이 아니면 거부", () => {
    expect(() => deserialize("not json{")).toThrow(ProjectFormatError);
  });

  it("version 불일치 거부", () => {
    const p = createBlankProject();
    const obj = JSON.parse(serialize(p));
    obj.version = 999;
    expect(() => deserialize(JSON.stringify(obj))).toThrow(/스키마 버전/);
  });

  it("lowerTiles 길이 불일치 거부", () => {
    const p = createBlankProject();
    const obj = JSON.parse(serialize(p));
    const mapId = obj.startMapId;
    obj.maps[mapId].lowerTiles = [0, 0, 0]; // 잘못된 길이
    expect(() => deserialize(JSON.stringify(obj))).toThrow(/lowerTiles 길이/);
  });

  it("알 수 없는 command kind 거부", () => {
    const p = createBlankProject();
    const obj = JSON.parse(serialize(p));
    const mapId = obj.startMapId;
    obj.maps[mapId].events = [
      {
        id: "ev1",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [{ kind: "explosive", power: 99 }],
      },
    ];
    expect(() => deserialize(JSON.stringify(obj))).toThrow(/알 수 없는 kind/);
  });

  it("changeFace 필드와 리소스 참조를 검증", () => {
    const p = createBlankProject();
    const obj = JSON.parse(serialize(p));
    const mapId = obj.startMapId;
    obj.maps[mapId].events = [
      {
        id: "ev1",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [
          {
            kind: "changeFace",
            resourceId: "missing-face",
            position: "left",
            flipHorizontally: false,
          },
        ],
      },
    ];
    expect(() => deserialize(JSON.stringify(obj))).toThrow(/resourceId/);

    obj.maps[mapId].events[0].commands[0].resourceId = "easyrpg-faceset-actor1-00";
    expect(deserialize(JSON.stringify(obj)).maps[mapId].events[0].commands[0]).toMatchObject({
      kind: "changeFace",
      resourceId: "easyrpg-faceset-actor1-00",
    });

    obj.maps[mapId].events[0].commands[0].position = "middle";
    expect(() => deserialize(JSON.stringify(obj))).toThrow(/position/);
  });

  it("displayTextSettings와 choices 취소 정책을 검증", () => {
    const p = createBlankProject();
    const obj = JSON.parse(serialize(p));
    const mapId = obj.startMapId;
    obj.maps[mapId].events = [
      {
        id: "ev1",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [
          {
            kind: "displayTextSettings",
            format: "glass",
            position: "bottom",
            preventObscuringPlayer: true,
            allowEventMovementDuringWait: false,
          },
        ],
      },
    ];
    expect(() => deserialize(JSON.stringify(obj))).toThrow(/format/);

    obj.maps[mapId].events[0].commands = [
      {
        kind: "choices",
        prompt: "계속?",
        cancelBehavior: "escape",
        options: [{ text: "예", branch: [] }],
      },
    ];
    expect(() => deserialize(JSON.stringify(obj))).toThrow(/cancelBehavior/);

    obj.maps[mapId].events[0].commands = [
      {
        kind: "choices",
        prompt: "five?",
        cancelBehavior: "choice5",
        options: [
          { text: "1", branch: [] },
          { text: "2", branch: [] },
          { text: "3", branch: [] },
          { text: "4", branch: [] },
          { text: "5", branch: [] },
        ],
      },
    ];
    expect(deserialize(JSON.stringify(obj)).maps[mapId].events[0].commands[0]).toMatchObject({
      kind: "choices",
      cancelBehavior: "choice5",
    });
  });

  it("inputNumber 자릿수와 대상 변수를 검증한다", () => {
    const p = createBlankProject();
    p.variables.push({ id: "var_pin", name: "PIN" });
    const obj = JSON.parse(serialize(p));
    const mapId = obj.startMapId;
    obj.maps[mapId].events = [
      {
        id: "ev1",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [{ kind: "inputNumber", variableId: "var_pin", digits: 6, prompt: "PIN", showPad: true }],
      },
    ];
    expect(deserialize(JSON.stringify(obj)).maps[mapId].events[0].commands[0]).toMatchObject({
      kind: "inputNumber",
      variableId: "var_pin",
      digits: 6,
      prompt: "PIN",
      showPad: true,
    });

    obj.maps[mapId].events[0].commands[0].digits = 7;
    expect(() => deserialize(JSON.stringify(obj))).toThrow(/digits/);
  });

  it("startMapId가 maps에 없으면 거부", () => {
    const p = createBlankProject();
    const obj = JSON.parse(serialize(p));
    obj.startMapId = "nope";
    expect(() => deserialize(JSON.stringify(obj))).toThrow(/startMapId/);
  });
});

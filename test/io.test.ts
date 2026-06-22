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
    expect(restored).toEqual(p);
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

  it("startMapId가 maps에 없으면 거부", () => {
    const p = createBlankProject();
    const obj = JSON.parse(serialize(p));
    obj.startMapId = "nope";
    expect(() => deserialize(JSON.stringify(obj))).toThrow(/startMapId/);
  });
});

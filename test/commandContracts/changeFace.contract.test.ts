// test/commandContracts/changeFace.contract.test.ts
// G1 계약: changeFace (스펙 §5.1 행).
//
// 실측 메모:
// - 런타임은 resourceId 존재 여부를 검증하지 않는다. 빈 resourceId 는 face 상태를 지우고,
//   truthy resourceId 는 프로젝트 리소스 등록 여부와 무관하게 이후 text pause 에 전달된다.
import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

// 얼굴 한 칸 = 파일 한 장. 시트 id + 칸 번호 짝은 없어졌고 낱장 얼굴 리소스 id 하나만 남는다.
const FACE_COMMAND: Extract<Command, { kind: "changeFace" }> = {
  kind: "changeFace",
  resourceId: "easyrpg-faceset-actor1-01",
  position: "left",
  flipHorizontally: false,
};

describe("changeFace 계약", () => {
  it("정상 효과: 이후 text pause 의 face 상태를 변경한다", () => {
    const result = runCommandContract([FACE_COMMAND, { kind: "text", body: "face" }]);

    expect(result.pauses).toEqual([
      expect.objectContaining({
        kind: "text",
        body: "face",
        face: {
          resourceId: "easyrpg-faceset-actor1-01",
          position: "left",
          flipHorizontally: false,
        },
      }),
    ]);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("결측 참조: 없는 resourceId 도 경고 없이 그대로 face 상태로 전달된다 — 실측 고정", () => {
    const result = runCommandContract([
      { ...FACE_COMMAND, resourceId: "missing-face-resource" },
      { kind: "text", body: "missing" },
    ]);

    expect(result.pauses[0]).toMatchObject({
      kind: "text",
      face: { resourceId: "missing-face-resource" },
    });
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("경계: 빈 resourceId 는 현재 face 상태를 지우고 text 는 face 없이 진행된다", () => {
    const result = runCommandContract([
      FACE_COMMAND,
      { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false },
      { kind: "text", body: "cleared" },
    ]);

    expect(result.pauses).toEqual([
      expect.objectContaining({ kind: "text", body: "cleared", face: undefined }),
    ]);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후 실행해도 text pause 의 face 가 같다", () => {
    const commands: Command[] = [FACE_COMMAND, { kind: "text", body: "roundtrip" }];

    const original = runCommandContract(commands);
    const restoredCommands = roundtripCommands(commands);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands);

    expect(restored.pauses).toEqual(original.pauses);
    expect(restored.session).toEqual(original.session);
  });

  it("pause 의미론: changeFace 자체는 non-blocking — 단독 실행 시 pause 가 없다", () => {
    const result = runCommandContract([FACE_COMMAND]);

    expect(result.pauses).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });
});

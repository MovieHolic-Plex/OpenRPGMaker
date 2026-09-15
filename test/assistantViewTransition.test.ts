// 조수가 사용자 화면을 갈아 끼울 때의 전환 판정 — 순수 함수라 씬·DOM 없이 검증한다.
// 실제 하드컷 지점: selectEditorMap 이 currentMapId 를 바꾸면 EditScene.redrawWhenViewStateChanges
// 가 한 프레임에 캔버스를 통째로 갈고, 카메라는 새 맵 한가운데로 붙는다(planEditorCameraCenter).

import { describe, expect, it } from "vitest";
import {
  ASSISTANT_DISSOLVE_COVER_MS,
  ASSISTANT_DISSOLVE_REVEAL_MS,
  planAssistantViewTransition,
  remainingCoverMs,
} from "@/editor/assistantViewTransition";

const options = { reducedMotion: false, canDissolve: true } as const;

describe("planAssistantViewTransition — 맵이 바뀔 때만 디졸브한다", () => {
  it("다른 맵으로 옮기면 디졸브다", () => {
    expect(planAssistantViewTransition({ fromMapId: "m1", toMapId: "m2" }, options)).toEqual({
      kind: "dissolve",
      coverMs: ASSISTANT_DISSOLVE_COVER_MS,
      revealMs: ASSISTANT_DISSOLVE_REVEAL_MS,
    });
  });

  it("같은 맵 안의 이동은 잘라 내지 않는다 — 이미 부드러운 팬이 연속성을 갖는다", () => {
    // 여기서 베일을 한 번 더 깜빡이면 팬이 시작하기도 전에 화면이 한 번 죽는다.
    expect(planAssistantViewTransition({ fromMapId: "m1", toMapId: "m1" }, options)).toEqual({ kind: "cut" });
  });

  it("아직 아무 맵도 안 열려 있으면 디졸브할 이전 화면이 없다", () => {
    expect(planAssistantViewTransition({ fromMapId: null, toMapId: "m1" }, options)).toEqual({ kind: "cut" });
  });

  it("동작 줄이기가 켜져 있으면 즉시 전환한다", () => {
    expect(
      planAssistantViewTransition({ fromMapId: "m1", toMapId: "m2" }, { ...options, reducedMotion: true })
    ).toEqual({ kind: "cut" });
  });

  it("덮을 캔버스가 없으면(헤드리스·테스트) 즉시 전환한다", () => {
    expect(
      planAssistantViewTransition({ fromMapId: "m1", toMapId: "m2" }, { ...options, canDissolve: false })
    ).toEqual({ kind: "cut" });
  });
});

describe("remainingCoverMs — 이미 떠 있는 베일에서 이어 덮는다", () => {
  it("맨 처음에는 전체 시간을 쓴다", () => {
    expect(remainingCoverMs(130, 0)).toBe(130);
  });

  it("반쯤 걷힌 베일은 남은 만큼만 다시 덮는다 — 튀지 않는다", () => {
    expect(remainingCoverMs(130, 0.5)).toBe(65);
  });

  it("이미 다 덮여 있으면 더 덮지 않는다", () => {
    expect(remainingCoverMs(130, 1)).toBe(0);
  });

  it("범위 밖 입력은 0..1 로 조인다", () => {
    expect(remainingCoverMs(130, -3)).toBe(130);
    expect(remainingCoverMs(130, 42)).toBe(0);
    expect(remainingCoverMs(130, Number.NaN)).toBe(130);
  });
});

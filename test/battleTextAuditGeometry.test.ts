// 전투 글자 가시성 계측의 **기하 판정** 단위 테스트.
//
// 왜 이 테스트가 있나: 이 판정의 초판은 세 갈래를 섞어서 rm2000 을 오진했다. 실측 기하로
//   · 스크롤 범위 안이라 커서가 데려오는 행 4건을 `clipped`(영구 절단)로 올렸고,
//   · 스크린샷에 실제로 반쯤 잘려 보이던 행은 한 건도 올리지 못했다.
// 위양성은 없는 버그를 고치게 만들고, 위음성은 있는 버그를 통과시킨다.
import { describe, expect, it } from "vitest";

import { classifyInkGeometry } from "../scripts/lib/battleTextAudit.mjs";

const box = (top: number, bottom: number, left = 0, right = 100) => ({ left, top, right, bottom });
/** 세로 스크롤포트. 전투 커맨드 메뉴가 이 모양이다(overflow-x: hidden, overflow-y: auto). */
const scrollPortY = (top: number, bottom: number) => ({ ...box(top, bottom), axisX: false, axisY: true });

describe("classifyInkGeometry", () => {
  it("절단 상자 안에 온전히 든 잉크는 위반이 아니다", () => {
    const verdict = classifyInkGeometry(box(10, 30), box(0, 100), null);
    expect(verdict).toEqual({ clippedRatio: 0, slicedRatio: 0, scrollReachable: false });
  });

  it("hidden 상자 밖으로 나간 만큼을 clippedRatio 로 센다 — 스크롤로 못 데려오는 영구 절단", () => {
    // 잉크 20px 중 아래 5px 이 상자 밖.
    const verdict = classifyInkGeometry(box(80, 100), box(0, 95), null);
    expect(verdict.clippedRatio).toBeCloseTo(0.25, 5);
    expect(verdict.slicedRatio).toBe(0);
  });

  it("스크롤포트 **경계에 걸친** 잉크는 sliced — 글리프가 세로로 반 잘려 그려진다", () => {
    // rm2000 실측 재현: 포트 546..726, 마지막 행 잉크 716..740 → 24px 중 14px 이 경계 밖.
    const verdict = classifyInkGeometry(box(716, 740), box(516, 804), scrollPortY(546, 726));
    expect(verdict.slicedRatio).toBeCloseTo(14 / 24, 5);
    expect(verdict.scrollReachable).toBe(false);
    // 바깥 hidden 상자(패널) 안에는 들어 있으니 영구 절단은 아니다.
    expect(verdict.clippedRatio).toBe(0);
  });

  it("스크롤포트 **완전히 밖**인 잉크는 위반이 아니다 — 커서가 scrollIntoView 로 데려온다", () => {
    // rm2000 실측 재현: 포트 546..726 인데 "검격" 행 잉크는 780..816(스크롤 범위 안).
    const verdict = classifyInkGeometry(box(780, 816), box(516, 804), scrollPortY(546, 726));
    expect(verdict.scrollReachable).toBe(true);
    expect(verdict.slicedRatio).toBe(0);
  });

  it("스크롤포트 안 노드는 바깥 hidden 상자와 비교하지 않는다 — 스크롤이 좌표를 바꾼다", () => {
    // 판정에 쓰는 절단 상자는 포트 아래에서 끊긴 것이어야 한다.
    const insidePortOnly = classifyInkGeometry(box(780, 816), null, scrollPortY(546, 726));
    expect(insidePortOnly.clippedRatio).toBe(0);
    expect(insidePortOnly.scrollReachable).toBe(true);
  });

  it("가로 절단도 같은 산식으로 잡는다 — 이름 뒤 식별 숫자가 잘리는 경로", () => {
    // 실측: 대상 행 strong client 114 / scroll 130 → 잉크 130 중 16px 이 밖.
    const verdict = classifyInkGeometry(box(0, 24, 0, 130), box(0, 24, 0, 114), null);
    expect(verdict.clippedRatio).toBeCloseTo(16 / 130, 5);
  });

  it("면적 0 잉크는 절단비 1 로 본다", () => {
    expect(classifyInkGeometry(box(10, 10), box(0, 100), null).clippedRatio).toBe(1);
  });

  it("허용 오차 이하의 반올림 삐침은 sliced 로 세지 않는다", () => {
    // 24px 잉크가 0.2px 만 삐친 경우(≈0.8%) — 기본 허용 오차 2% 안.
    const verdict = classifyInkGeometry(box(700, 724), box(516, 804), scrollPortY(546, 723.8));
    expect(verdict.slicedRatio).toBe(0);
  });
});

// 도주 유예(@/player/chaseSpawnGrace): 전투에서 도망친 직후에는 추격자가 서 있고 이벤트 쪽 접촉 전투가 열리지 않는다.
// 2026-11-14 폴른 스타 QA — 숲 어귀에서 도망치자 0.8초 뒤 한 걸음도 떼지 않았는데 곁의 다른 무리가 새 전투를 열었다.
import { afterEach, describe, expect, it } from "vitest";

import {
  ESCAPE_GRACE_AFTER_MOVE_MS,
  ESCAPE_GRACE_CAP_MS,
  ESCAPE_GRACE_MS,
  escapeGraceActive,
  startEscapeGrace,
  tickEscapeGrace,
} from "@/player/chaseSpawnGrace";
import { store } from "@/project/store";
import { event, fixture, pos, ticks } from "./fixtures/npcChasePathfinding";

const getCurrent = store.getCurrent;
afterEach(() => { store.getCurrent = getCurrent; });

const here = { mapId: "m", x: 5, y: 2 };

describe("도주 유예 시간 규칙", () => {
  it("도망친 칸에 서 있는 동안에는 유예가 이어지고, 상한이 지나면 끝난다", () => {
    const session = {};
    startEscapeGrace(session, here);
    let spent = 0;
    while (spent + 500 < ESCAPE_GRACE_CAP_MS) {
      spent += 500;
      expect(tickEscapeGrace(session, 500, here)).toBe(true);
    }
    expect(escapeGraceActive(session, "m")).toBe(true);
    expect(tickEscapeGrace(session, 600, here)).toBe(false);
    expect(escapeGraceActive(session, "m")).toBe(false);
  });

  it("걸음을 뗀 뒤에는 남은 시간만큼만 이어진다 — 곧바로 뗐으면 처음 준 시간, 오래 서 있다 뗐으면 최소 보장 시간", () => {
    const quick = {};
    startEscapeGrace(quick, here);
    const away = { mapId: "m", x: 5, y: 4 };
    expect(tickEscapeGrace(quick, ESCAPE_GRACE_MS - 100, away)).toBe(true);
    expect(tickEscapeGrace(quick, 200, away)).toBe(false);

    const slow = {};
    startEscapeGrace(slow, here);
    expect(tickEscapeGrace(slow, ESCAPE_GRACE_MS + 1000, here)).toBe(true);
    expect(tickEscapeGrace(slow, ESCAPE_GRACE_AFTER_MOVE_MS - 100, away)).toBe(true);
    expect(tickEscapeGrace(slow, 200, away)).toBe(false);
  });

  it("대사·전투 중(0ms)에는 줄지 않고, 다른 맵으로 나가면 끝난다", () => {
    const session = {};
    startEscapeGrace(session, here);
    for (let i = 0; i < 1000; i++) expect(tickEscapeGrace(session, 0, { mapId: "m", x: 9, y: 9 })).toBe(true);
    expect(escapeGraceActive(session, "other")).toBe(false);
    expect(tickEscapeGrace(session, 16, { mapId: "other", x: 5, y: 2 })).toBe(false);
    expect(escapeGraceActive(session, "m")).toBe(false);
  });

  it("도망치지 않았으면 유예가 없다", () => {
    const session = {};
    expect(tickEscapeGrace(session, 16, here)).toBe(false);
    expect(escapeGraceActive(session, "m")).toBe(false);
  });
});

describe("도주 유예 중 추격자", () => {
  it("유예가 없으면 추격자가 다가와 접촉 이벤트를 연다(기준)", () => {
    const f = fixture(7, 5, [event("a", 1, 2)], 5, 2);
    ticks(f.scene);
    expect(f.scene.touches).toBeGreaterThan(0);
  });

  it("도망친 직후에는 추격자가 제자리에 서고 접촉 이벤트가 열리지 않는다 — 주인공이 서 있기만 해도", () => {
    const f = fixture(7, 5, [event("a", 1, 2)], 5, 2);
    startEscapeGrace(f.scene.session, here);
    // 80ms × 60 = 4.8초: 처음 준 시간(2.5초)을 넘겨도 서 있는 동안은 이어진다.
    ticks(f.scene, 60);
    expect(pos(f.scene)).toMatchObject({ x: 1, y: 2 });
    expect(f.scene.touches).toBe(0);
  });

  it("바로 곁에 붙어 선 추격자도 유예 중에는 접촉 이벤트를 열지 않고, 유예가 끝나면 다시 연다", () => {
    const f = fixture(7, 5, [event("a", 4, 2)], 5, 2);
    startEscapeGrace(f.scene.session, here);
    ticks(f.scene, 60);
    expect(f.scene.touches).toBe(0);
    // 상한(8초)을 넘기면 저작한 대로 돌아간다.
    ticks(f.scene, 80);
    expect(f.scene.touches).toBeGreaterThan(0);
  });

  it("걸어서 벗어난 뒤 유예가 끝나면 추격자가 다시 쫓아와 닿는다", () => {
    const f = fixture(7, 5, [event("a", 1, 2)], 5, 2);
    startEscapeGrace(f.scene.session, here);
    ticks(f.scene, 10);
    f.scene.tileX = 6; f.scene.session.x = 6;
    // 걸음을 뗀 뒤 남은 유예(2.5초 − 0.8초 = 1.7초) 안에서는 아직 서 있다.
    ticks(f.scene, 15);
    expect(pos(f.scene)).toMatchObject({ x: 1, y: 2 });
    expect(f.scene.touches).toBe(0);
    ticks(f.scene, 120);
    expect(f.scene.touches).toBeGreaterThan(0);
  });
});

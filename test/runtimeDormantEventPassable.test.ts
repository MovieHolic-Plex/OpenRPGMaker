import { describe, expect, it } from "vitest";
import { eventBlocksPlayerAt, runtimeEventView } from "@/project/runtimeEventState";
import type { GameEvent } from "@/project/types";

// 한 번 돈 자동 컷신(once)은 셀프 스위치 A 로 유일한 페이지가 꺼진다 — 그 이벤트는 맵에 없는 것과 같아야 한다.
// 2026-09-24 회상 스토리: 레코드 가게 진입 컷신 ev_record_intro (6,6) 이 돈 뒤 보이지 않는 벽으로 남아
// 메모 메멘토에 가는 길을 막았다(기본값 same·겹침 금지).
const intro = {
  id: "ev_record_intro", x: 6, y: 6, trigger: { kind: "auto" }, commands: [],
  pages: [{
    id: "p1", conditions: [{ kind: "selfSwitch", key: "A", value: false }], graphic: { transparent: true },
    trigger: { kind: "auto" }, priority: "below", overlapForbidden: false, commands: [],
  }],
} as unknown as GameEvent;

describe("활성 페이지가 없는 이벤트는 길을 막지 않는다", () => {
  it("once 자동 컷신이 끝난 자리는 below·통과·투명", () => {
    const session = { selfSwitches: { ev_record_intro: { A: true } } } as never;
    const view = runtimeEventView(intro, session, {});
    expect(view.priority).toBe("below");
    expect(view.overlapForbidden).toBe(false);
    expect(view.transparent).toBe(true);
    expect(eventBlocksPlayerAt([intro], session, {}, 6, 6)).toBe(false);
  });

  it("페이지가 없는 옛 이벤트는 예전 기본값(same·막힘)을 유지", () => {
    const legacy = { id: "ev_old", x: 1, y: 1, trigger: { kind: "action" }, commands: [] } as unknown as GameEvent;
    const view = runtimeEventView(legacy, {} as never, {});
    expect(view.priority).toBe("same");
    expect(view.overlapForbidden).toBe(true);
  });
});

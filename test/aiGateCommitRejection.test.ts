import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
// 커밋 게이트가 반려 사유로 **이 변경이 만든 오류**만 보고하는지.
//
// 예전 구현은 `commit.issues` 에서 첫 error 를 골랐다. issues 에는 이 변경이 만들지 않은 선재
// 오류도 들어 있으므로(commitChangeset 이 baseline 대조로 blocking 만 걸러낸다), 사용자에게
// 반려와 무관한 문장이 사유로 나갔다 — 예: 시작 위치가 원래 깨져 있던 프로젝트에서 이벤트를
// 지우다 막히면 "시작 위치가 맵 경계 밖입니다" 가 사유로 표시됐다.
import { describe, expect, it, vi } from "vitest";
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";

function page(commands: EventPage["commands"]): EventPage {
  return {
    id: "page_1",
    name: "본문",
    conditions: [],
    graphic: { transparent: true },
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

function eventWith(id: string, commands: EventPage["commands"]): GameEvent {
  return { id, x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page(commands)] };
}

describe("커밋 게이트 반려 사유", () => {
  it("선재 오류는 사유에서 빼고, 이 변경이 새로 만든 오류만 전량 보고한다", async () => {
    vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "");
    vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", "");
    vi.stubEnv("VITE_LEGACY_DB_URL", "");
    try {
      // baseline: 시작 위치가 이미 맵 밖이다(선재 blocking 오류).
      const before = createBlankProject();
      before.startPos = { x: 9999, y: 9999 };
      store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
      store.replaceProject(before);
      resetMapEditHistory();
      const base = captureProposalBase(store.getCurrent());

      // 제안: 선재 오류를 그대로 두고, transfer 목적지가 맵 밖인 이벤트 두 개를 새로 만든다.
      const proposed = structuredClone(before);
      const mapId = proposed.startMapId;
      proposed.maps[mapId].events.push(
        eventWith("ev_bad_1", [{ kind: "transfer", mapId, x: 500, y: 500 }]),
        eventWith("ev_bad_2", [{ kind: "transfer", mapId, x: 600, y: 600 }]),
      );

      const result = await applyProposedProject(proposed, {
        base,
        baseline: new AuthoredProjectBaseline(before),
        source: "agent",
        summary: "이벤트 추가",
        toolNames: ["upsert_event"],
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("게이트가 통과했다");
      const reasons = (result.issues ?? []).join("\n");
      expect(result.issues?.length).toBe(2);
      expect(reasons).toContain("500");
      expect(reasons).toContain("600");
      // 선재 오류(시작 위치)는 이 반려의 사유가 아니다.
      expect(reasons).not.toContain("시작 위치");
      expect(result.issue).toBe(result.issues?.[0]);
      // 반려 시 저장소는 그대로다.
      expect(store.getCurrent().maps[mapId].events).toHaveLength(before.maps[mapId].events.length);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

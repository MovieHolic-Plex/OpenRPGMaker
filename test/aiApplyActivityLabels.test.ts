// AI 적용 경로의 행위 라벨 회귀 테스트.
//
// 2026-08-29 실측: `applyChangesetToStore.ts` 의 `store.replace` 3곳과
// `runRegionTask.ts` 의 1곳이 change descriptor 없이 호출되고 있었다. 그래서 **AI 로 만든
// 편집 전량**이 기본값 `{ scope: "project" }` + 라벨 없음 + `origin: "human"` 으로 떨어졌다.
//
// 이게 왜 치명적인가: 이 프로젝트의 실제 작업은 대부분 채팅/영역 AI 로 이뤄진다.
// 즉 손편집을 계측해 놓고 정작 주 경로를 비워 둔 상태였고, 고치려던 증상
// (「무엇을 고쳤는지 기록에 없다」)이 AI 쪽에 그대로 남아 있었다.
//
// 이 파일은 (1) AI/툴 적용이 라벨을 남기고 (2) origin 으로 사람과 구분되며
// (3) 무엇이 몇 개 바뀌었는지 필드로 남는 것을 고정한다.

import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetEditActivityForTest,
  getEditActivityEntries,
  unlabeledEditActivityCount,
} from "@/editor/editActivityLog";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { applyProposedProject, applyToolSequenceToStore, applyToolToStore } from "@/editor/tools/applyChangesetToStore";
import { aiHistoryLabel } from "@/editor/panels/aiChatPanelHelpers";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";

function mapId(): string {
  return store.getCurrent().startMapId;
}

beforeEach(() => {
  _resetEventDraftVaultForTest();
  store.replaceProject(createBlankProject());
  resetMapEditHistory();
  _resetEditActivityForTest();
});

describe("단일 툴 적용", () => {
  it("툴 이름과 요약을 라벨로 남기고 origin 을 tool 로 표시한다", () => {
    const result = applyToolToStore("paint_tiles", {
      mapId: mapId(), layer: "lower", mode: "cells", tile: 5, cells: [{ x: 1, y: 1 }],
    });
    expect(result.ok, result.summary).toBe(true);

    const entry = getEditActivityEntries()[0];
    expect(entry, "적용 기록이 있어야 한다").toBeDefined();
    // 핵심: 어떤 툴이었는지 라벨에 있어야 한다. 예전에는 라벨 자체가 없었다.
    expect(entry!.label).toContain("paint_tiles");
    // 핵심: 사람 손편집과 구분돼야 한다.
    expect(entry!.origin).toBe("tool");
    expect(unlabeledEditActivityCount()).toBe(0);
  });

  it("무엇이 몇 개 바뀌었는지 필드로 남긴다", () => {
    applyToolToStore("paint_tiles", {
      mapId: mapId(), layer: "lower", mode: "cells", tile: 5, cells: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
    });
    const fields = getEditActivityEntries()[0]?.fields ?? [];
    const paths = fields.map((field) => field.path);
    expect(paths).toContain("tilesChanged");
    expect(paths).toContain("tools");
    // 변경 없는 축(0)은 싣지 않는다 — 0 이 스무 줄이면 정작 바뀐 축을 못 찾는다.
    expect(paths).not.toContain("mapsRemoved");
  });

  it("실패한 툴은 기록을 남기지 않는다", () => {
    const result = applyToolToStore("paint_tiles", {
      mapId: "존재하지-않는-맵", layer: "lower", mode: "cells", tile: 5, cells: [{ x: 1, y: 1 }],
    });
    expect(result.ok).toBe(false);
    expect(getEditActivityEntries()).toHaveLength(0);
  });
});

describe("툴 묶음 적용", () => {
  it("에이전트 경로는 origin 을 ai 로, 사람 툴 묶음은 tool 로 남긴다", () => {
    const calls = [
      { name: "paint_tiles", args: { mapId: mapId(), layer: "lower", mode: "cells", tile: 6, cells: [{ x: 3, y: 3 }] } },
    ];

    applyToolSequenceToStore(calls, { source: "agent", agentName: "claude-opus-5" });
    const agentEntry = getEditActivityEntries()[0]!;
    expect(agentEntry.origin).toBe("ai");
    expect(agentEntry.label).toContain("AI 적용");
    // 어느 에이전트였는지도 남아야 한다 — 모델을 바꿔 가며 쓰면 그게 조사 단서다.
    expect(agentEntry.label).toContain("claude-opus-5");

    _resetEditActivityForTest();
    applyToolSequenceToStore(
      [{ name: "paint_tiles", args: { mapId: mapId(), layer: "lower", mode: "cells", tile: 6, cells: [{ x: 4, y: 3 }] } }],
      { source: "human" },
    );
    expect(getEditActivityEntries()[0]!.origin).toBe("tool");
  });
});

// 스코프 턴(선택 영역이 걸린 조수 턴)도 조수와 같은 적용 함수를 쓴다 —
// 예전의 applyRegionProjectWithHistory 는 없어졌고, 지시문은 aiProposalCard 가
// aiHistoryLabel(calls, instruction) 으로 라벨에 실어 넘긴다.
async function applyAsScopedTurn(proposed: Parameters<typeof applyProposedProject>[0], instruction: string) {
  const calls = [{ name: "paint_tiles", summary: "타일 1칸" }] as const;
  return applyProposedProject(proposed, {
    source: "agent",
    agentName: "claude-opus-5",
    summary: aiHistoryLabel(calls as never, instruction),
    toolNames: calls.map((call) => call.name),
    snapshotMapId: mapId(),
  });
}

describe("스코프 턴(영역) 적용", () => {
  it("라벨을 AI 소행으로 남긴다", async () => {
    const proposed = structuredClone(store.getCurrent());
    proposed.maps[mapId()]!.lowerTiles[0] = 9;

    const applied = await applyAsScopedTurn(proposed, "아이들이 놀고있다");
    expect(applied.ok).toBe(true);

    const entry = getEditActivityEntries()[0]!;
    expect(entry.origin).toBe("ai");
    // 지시문이 그대로 남아야 한다 — "무엇을 시켰더니 이렇게 됐다" 가 조사의 출발점이다.
    expect(entry.label).toContain("아이들이 놀고있다");
    expect(unlabeledEditActivityCount()).toBe(0);
  });
});

describe("완료 조건", () => {
  it("AI 경로를 전부 돌려도 라벨 없는 mutation 이 0 이다", async () => {
    applyToolToStore("paint_tiles", { mapId: mapId(), layer: "lower", mode: "cells", tile: 5, cells: [{ x: 1, y: 1 }] });
    applyToolSequenceToStore(
      [{ name: "paint_tiles", args: { mapId: mapId(), layer: "lower", mode: "cells", tile: 5, cells: [{ x: 2, y: 2 }] } }],
      { source: "agent" },
    );
    const proposed = structuredClone(store.getCurrent());
    proposed.maps[mapId()]!.lowerTiles[5] = 3;
    await applyAsScopedTurn(proposed, "집들을 만들어라");

    expect(unlabeledEditActivityCount()).toBe(0);
    // origin 이 human 인 엔트리가 섞이면 오귀속이다 — AI 작업이 사람 편집으로 보인다.
    expect(getEditActivityEntries().every((entry) => entry.origin !== "human")).toBe(true);
  });
});

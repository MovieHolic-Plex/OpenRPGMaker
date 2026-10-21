// src/editor/workshop/installOwnership.ts
/**
 * 공방 결과를 프로젝트에 넣을 때(칩셋 굽기·묶음 넣기) 「맵 하나에 조수 한 명」 예약을 따른다(AGENTS.md hard rule,
 * openwiki/editor-ai-panel.md 「맵 하나에 조수 한 명」). 넣기는 그 칩셋을 쓰는 맵들의 그림을 바꾸므로, 그 맵을 쥔 조수 실행이 있으면
 * 넣지 않고 기다린다 — 조수 턴이 시작할 때 잡은 기준본과 어긋나 결과가 통째로 거절되는 것도 막는다.
 * 예약은 동기라 굽기(동기 store.update) 앞뒤로 잡고 바로 놓는다. 쓰는 맵이 없으면(새 칩셋) 프로젝트 전체를 본다 — 조수가 하나라도 돌면 기다린다.
 */
import { editorAiMapRuns } from "@/ai/piAgent/editorMapRunLocks";
import { aiProjectRunKey } from "@/editor/aiMapRunOwnership";
import { store } from "@/project/store";

/** 조수가 그 맵을 쥐고 있어 지금 넣을 수 없다 — 작업 줄은 이것을 보고 기다렸다가 다시 넣는다. */
export class WorkshopInstallBusy extends Error {
  constructor(readonly owner: string) {
    super("조수가 이 칩셋을 쓰는 맵에서 일하는 중이에요. 그 작업이 끝나면 넣을 수 있어요.");
    this.name = "WorkshopInstallBusy";
  }
}

export function mapsUsingTileset(tilesetId: string): string[] {
  return Object.values(store.getCurrent().maps).filter((map) => map.tilesetId === tilesetId).map((map) => map.id);
}

/** tilesetIds = 넣기가 바꾸는 칩셋(없으면 = 새 칩셋, 프로젝트 전체). 예약을 못 잡으면 WorkshopInstallBusy 를 던진다. */
export function withInstallOwnership<T>(tilesetIds: readonly string[], label: string, work: () => T): T {
  const maps = [...new Set(tilesetIds.flatMap(mapsUsingTileset))];
  const claim = editorAiMapRuns.acquire(aiProjectRunKey(), maps.length ? maps : null, label);
  if (!claim.ok) throw new WorkshopInstallBusy(String(claim.owner ?? "조수"));
  try {
    return work();
  } finally {
    claim.release();
  }
}

/** 예약이 풀릴 때마다 부른다(작업 줄의 「넣는 중」 다시 시도). */
export function onInstallOwnershipChange(listener: () => void): () => void {
  return editorAiMapRuns.subscribe(listener);
}

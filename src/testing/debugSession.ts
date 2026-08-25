// testing/debugSession.ts
// 런타임 디버그 조작(스위치/변수/아이템/골드/회복/텔레포트)과 상태 프리셋을 순수 함수로 제공한다.
// Phase 4-1. 브라우저 디버그 패널과 __oprnDebug 훅, 헤드리스 테스트가 공용으로 사용한다.
// 프리셋은 프로젝트 JSON을 건드리지 않고 localStorage(oprn:test-presets)에 저장한다.

import { changeGold, changeItem, setSwitch, setVariable, type PlaySession } from "@/project/session";
import { recoverAll } from "@/project/sessionActorCommands";
import type { TestPreset } from "@/project/types";

// 단일 디버그 조작.
export type DebugOp =
  | { kind: "setSwitch"; switchId: string; value: boolean }
  | { kind: "setVariable"; variableId: string; value: number }
  | { kind: "giveItem"; itemId: string; amount: number }
  | { kind: "setGold"; amount: number }
  | { kind: "heal" }
  | { kind: "teleport"; mapId: string; x: number; y: number };

// 세션에 디버그 조작 1건을 적용한다(순수, 브라우저 비의존).
export function applyDebugOp(session: PlaySession, op: DebugOp): void {
  switch (op.kind) {
    case "setSwitch":
      setSwitch(session, op.switchId, op.value);
      return;
    case "setVariable":
      setVariable(session, op.variableId, "=", op.value);
      return;
    case "giveItem":
      changeItem(session, op.itemId, op.amount >= 0 ? "+=" : "-=", Math.abs(op.amount));
      return;
    case "setGold":
      changeGold(session, "=", Math.max(0, op.amount));
      return;
    case "heal":
      recoverAll(session, undefined);
      return;
    case "teleport":
      session.currentMapId = op.mapId;
      session.x = op.x;
      session.y = op.y;
      return;
  }
}

// ── 상태 프리셋 ──────────────────────────────────────────────────
// 프로젝트 스키마의 TestPreset과 동일 형태(프로젝트 저장 필드 project.testPresets와 호환).
export type StatePreset = TestPreset;

// 프리셋을 세션에 적용한다. 지정된 키만 덮어쓴다(부분 적용).
export function applyStatePreset(session: PlaySession, preset: StatePreset): void {
  if (preset.switches) for (const [id, value] of Object.entries(preset.switches)) session.switches[id] = value;
  if (preset.variables) for (const [id, value] of Object.entries(preset.variables)) session.variables[id] = value;
  if (preset.inventory) for (const [id, value] of Object.entries(preset.inventory)) {
    if (value <= 0) delete session.inventory[id];
    else session.inventory[id] = value;
  }
  if (preset.gold !== undefined) session.gold = Math.max(0, preset.gold);
  if (preset.startMapId) session.currentMapId = preset.startMapId;
  if (preset.startPos) {
    session.x = preset.startPos.x;
    session.y = preset.startPos.y;
  }
}

// "여기서 테스트": 지정 좌표에서 시작하도록 세션 시작점을 오버라이드한 프리셋을 만든다.
export function testHerePreset(mapId: string, x: number, y: number): StatePreset {
  return { id: "test-here", name: `여기서 테스트(${mapId} ${x},${y})`, startMapId: mapId, startPos: { x, y } };
}

// 프리셋 목록에 upsert(같은 id면 교체). 순수 함수 — 프로젝트 저장(project.testPresets)에 사용한다.
export function upsertPreset(presets: readonly StatePreset[], preset: StatePreset): StatePreset[] {
  return [...presets.filter((p) => p.id !== preset.id), preset];
}

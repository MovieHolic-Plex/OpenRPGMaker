// ai/session/eventTargets.ts
// 제안 안에서 이벤트가 최종적으로 어디 서 있는가를 추적한다.
//
// 모델은 이벤트를 만든 뒤 move_event 로 다시 옮기는 일이 흔하다. 제안 카드가 생성 시점
// 좌표만 보여주면 사용자가 승인하는 그림과 적용 결과가 어긋난다 — 생성 제안의 인자·요약·
// data 를 이동 후 좌표로 접어 넣어 "프리뷰 == 적용" 을 유지한다.

import { isRecord, numberValue, stringValue } from "./unknownValue";
import type { ProposedCall } from "./types";

export interface EventTargetKey {
  readonly mapId: string;
  readonly eventId: string;
}

export interface EventMoveTarget extends EventTargetKey {
  readonly x: number;
  readonly y: number;
}

export function proposalKey(proposal: ProposedCall): string {
  return `${proposal.name}:${JSON.stringify(proposal.args)}`;
}

/** 산포 툴 중복 억제 키 — seed 는 무시(같은 배치 의도 재호출 방지). */
export function writeDedupeKey(name: string, args: Record<string, unknown>): string | null {
  if (name !== "place_props") return null;
  const mapId = typeof args.mapId === "string" ? args.mapId : "";
  const material = typeof args.material === "string" ? args.material.trim() : typeof args.propVocabId === "string" ? args.propVocabId.trim() : "";
  const count = typeof args.count === "number" ? args.count : args.count;
  const area = args.area;
  return `place_props|${mapId}|${JSON.stringify(area)}|${material}|${String(count)}`;
}

export function moveEventTarget(proposal: ProposedCall): EventMoveTarget | null {
  if (proposal.name !== "move_event") return null;
  const mapId = stringValue(proposal.args.mapId);
  const eventId = stringValue(proposal.args.eventId);
  const x = numberValue(proposal.args.x);
  const y = numberValue(proposal.args.y);
  return mapId === null || eventId === null || x === null || y === null ? null : { mapId, eventId, x, y };
}

export function eventBaseTarget(proposal: ProposedCall): EventTargetKey | null {
  if (proposal.name === "place_npc" || proposal.name === "make_villager" || proposal.name === "place_battle_blocker") {
    const mapId = stringValue(proposal.args.mapId);
    const data = isRecord(proposal.result.data) ? proposal.result.data : null;
    const eventId = stringValue(data?.eventId) ?? stringValue(proposal.args.id);
    return mapId === null || eventId === null ? null : { mapId, eventId };
  }

  if (proposal.name === "upsert_event") {
    const mapId = stringValue(proposal.args.mapId);
    const event = isRecord(proposal.args.event) ? proposal.args.event : null;
    const eventId = stringValue(event?.id);
    return mapId === null || eventId === null ? null : { mapId, eventId };
  }

  if (proposal.name === "duplicate_event") {
    const mapId = stringValue(proposal.args.toMapId);
    const data = isRecord(proposal.result.data) ? proposal.result.data : null;
    const eventId = stringValue(data?.eventId) ?? stringValue(proposal.args.newId);
    return mapId === null || eventId === null ? null : { mapId, eventId };
  }

  return null;
}

export function withMovedEventBaseProposal(base: ProposedCall, move: EventMoveTarget): ProposedCall {
  const args = structuredClone(base.args);

  if (base.name === "place_npc" || base.name === "place_battle_blocker" || base.name === "duplicate_event") {
    args.x = move.x;
    args.y = move.y;
  } else if (base.name === "make_villager") {
    const home = isRecord(args.home) ? args.home : null;
    if (home !== null) args.home = { ...home, x: move.x, y: move.y };
  } else if (base.name === "upsert_event") {
    const event = isRecord(args.event) ? args.event : null;
    if (event !== null) args.event = { ...event, x: move.x, y: move.y };
  } else {
    return base;
  }

  return {
    ...base,
    args,
    summary: summaryWithFinalEventPosition(base.summary, move),
    result: { ...base.result, data: dataWithEventPosition(base.result.data, move) },
  };
}

function summaryWithFinalEventPosition(summary: string, move: EventMoveTarget): string {
  const coord = `(${move.x}, ${move.y})`;
  const replaced = summary.replace(/배치 \(-?\d+,\s*-?\d+\)/, `배치 ${coord}`);
  return replaced !== summary ? replaced : `${summary} — 최종 위치 ${coord}`;
}

function dataWithEventPosition(data: unknown, move: EventMoveTarget): unknown {
  return isRecord(data) ? { ...data, x: move.x, y: move.y } : data;
}

export function eventTargetKey(target: EventTargetKey): string {
  return `${target.mapId}:${target.eventId}`;
}

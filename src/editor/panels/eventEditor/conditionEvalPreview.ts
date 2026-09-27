import { actorQueryConditionSummary } from "./actorQueryConditionForm";
import { el } from "@/util/dom";
import { difficultyDisplayName } from "@/project/difficulty";
import { evalCondition } from "@/project/session";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import type { Condition } from "@/project/types";
import { createPreviewSimState, previewSessionFromSimState, resolvePreviewLocations } from "./previewSimulation";

import { relationshipStateName } from "@/project/relationshipState";
import { insideLocationSentence } from "@/editor/mapLocationLabels";
type PreviewVerdict = boolean | undefined;

/**
 * Live condition evaluation against the editor's play-start simulation.
 * Conditions that require state produced only during play stay explicitly undetermined.
 */
export function renderConditionEvalPreview(condition: Condition | undefined, mapId?: string): HTMLElement {
  const session = previewSessionFromSimState(createPreviewSimState());
  const hostId = editorState.get().selectedEventId;
  const verdict = evaluatePreviewCondition(session, condition, hostId ?? undefined, mapId);
  const summary = describeCondition(condition);
  const determined = verdict !== undefined;
  const badgeText = determined ? (verdict ? "충족" : "불충족") : "판정 불가";
  const dataset: Record<string, string> = { testid: "event-condition-eval" };
  if (determined) dataset.evalOk = verdict ? "true" : "false";

  return el("div", {
    class: `event-condition-eval ${determined ? (verdict ? "is-true" : "is-false") : "is-undetermined"}`,
    dataset,
    children: [
      el("div", {
        class: "event-condition-eval-badge",
        text: badgeText,
        dataset: { testid: "event-condition-eval-badge" },
      }),
      el("div", {
        class: "event-condition-eval-body",
        children: [
          el("div", {
            class: "event-condition-eval-summary",
            text: summary,
            dataset: { testid: "event-condition-eval-summary" },
          }),
          ...(determined
            ? []
            : [
                el("div", {
                  class: "event-condition-eval-note",
                  text: "플레이 중 상태가 필요해 여기서는 판정할 수 없습니다.",
                  dataset: { testid: "event-condition-eval-undetermined" },
                }),
              ]),
          el("div", {
            class: "event-condition-eval-note",
            text: hostId
              ? `플레이 시작 시뮬 상태 기준 · 호스트 ${hostId.replace(/^ev_[0-9a-f-]+$/i, "(자동 생성)")}`
              : "플레이 시작 시뮬 상태 기준 · 선택 이벤트 없음(셀프/활동 조건은 판정하지 않음)",
          }),
        ],
      }),
    ],
  });
}

function evaluatePreviewCondition(
  session: PlaySessionLike,
  condition: Condition | undefined,
  hostEventId: string | undefined,
  mapId?: string
): PreviewVerdict {
  if (!condition) return true;
  switch (condition.kind) {
    case "all": {
      let hasUndetermined = false;
      for (const child of condition.conditions) {
        const childVerdict = evaluatePreviewCondition(session, child, hostEventId, mapId);
        if (childVerdict === false) return false;
        if (childVerdict === undefined) hasUndetermined = true;
      }
      return hasUndetermined ? undefined : true;
    }
    case "any": {
      let hasUndetermined = false;
      for (const child of condition.conditions) {
        const childVerdict = evaluatePreviewCondition(session, child, hostEventId, mapId);
        if (childVerdict === true) return true;
        if (childVerdict === undefined) hasUndetermined = true;
      }
      return hasUndetermined ? undefined : false;
    }
    case "not": {
      const childVerdict = evaluatePreviewCondition(session, condition.condition, hostEventId, mapId);
      return childVerdict === undefined ? undefined : !childVerdict;
    }
    case "monsterSpecies":
      return undefined;
    case "selfSwitch":
      if (!hostEventId) return undefined;
      break;
    case "timer":
      if (!Object.hasOwn(session.timers, condition.timerId)) return undefined;
      break;
    case "timePhase":
    case "season":
      if (!session.gameTime) return undefined;
      break;
    case "npcActivity":
      if (!hostEventId || !Object.hasOwn(session.npcActivities ?? {}, hostEventId)) return undefined;
      break;
    case "insideLocation": {
      // 편집 중인 맵의 로케이션 기하가 있으면 실제 판정한다 — 시뮬레이션과 같은 입력.
      // 맵을 모르면 참/거짓을 지어내지 않고 판정 불가로 남긴다.
      const locations = resolvePreviewLocations(mapId);
      if (!locations) return undefined;
      break;
    }
    case "friendshipAtLeast": {
      const npcKey = condition.npcKey?.trim();
      if (!npcKey || !Object.hasOwn(session.friendship ?? {}, npcKey)) return undefined;
      break;
    }
    case "relationshipAtLeast": {
      const npcKey = condition.npcKey?.trim();
      if (!npcKey || !Object.hasOwn(session.relationships ?? {}, npcKey)) return undefined;
      break;
    }
    case "battleResult":
      if (session.battleResult === undefined) return undefined;
      break;
    case "run":
      if (session.roguelikeRun === undefined) return undefined;
      break;
    case "actorStat":
    case "actorState":
    case "partyLeader":
    case "partySize":
    case "facing":
    case "relativeFacing":
    case "hiding":
    case "pursuitActive":
    case "clearCount":
    case "endingSeen":
    case "newGamePlus":
    case "weekday":
    case "stringVariable":
      // 편집기 미리보기에는 실제 파티 수치·방향·회차가 없다 — 판정 불가로 둔다.
      return undefined;
  }
  const locations = resolvePreviewLocations(mapId);
  return evalCondition(session, condition, hostEventId, locations ? { map: { locations } } : undefined);
}

function describeCondition(condition: Condition | undefined): string {
  if (!condition) return "(조건 없음)";
  switch (condition.kind) {
    case "switch":
      return `${recordName("switch", condition.switchId)} ${condition.value ? "켜짐" : "꺼짐"}`;
    case "variable":
      return `${recordName("variable", condition.variableId)} ${comparison(condition.op, condition.value)}`;
    case "selfSwitch":
      return `이 이벤트 기억 ${condition.key} ${condition.value ? "켜짐" : "꺼짐"}`;
    case "monsterSpecies":
      return `${condition.speciesId} ${condition.present ? "파티 또는 박스에 보유" : "보유하지 않음"}`;
    case "actor":
      return `${databaseRecordName("actors", condition.actorId)} ${condition.present ? "파티에 있음" : "파티에 없음"}`;
    case "item":
      return `${databaseRecordName("items", condition.itemId)} ${condition.present ? "보유 중" : "보유 안 함"}`;
    case "gold":
      return `소지금 ${comparison(condition.op, condition.amount)}`;
    case "timer":
      return `${condition.timerId === "timer1" ? "타이머 1" : "타이머 2"} ${condition.seconds}초 이하`;
    case "timePhase":
      return `시간대 ${timePhaseName(condition.phase)}`;
    case "season":
      return `계절 ${seasonName(condition.season)}`;
    case "npcActivity":
      return `활동 ${condition.activity || "(없음)"}일 때`;
    case "insideLocation":
      return `${insideLocationSentence(condition.locationId, condition.inside)}일 때`;
    case "friendshipAtLeast":
      return `${condition.npcKey?.trim() || "이 이벤트"} 호감도 ${condition.value} 이상`;
    case "relationshipAtLeast":
      return `${condition.npcKey?.trim() || "이 이벤트"} 관계 ${relationshipStateName(condition.state)} 이상`;
    case "battleResult":
      return `전투 결과 ${battleResultName(condition.result)}일 때`;
    case "run":
      return runConditionDescription(condition);
    case "actorStat":
    case "actorState":
    case "partyLeader":
    case "partySize":
    case "facing":
    case "relativeFacing":
    case "hiding":
    case "pursuitActive":
    case "clearCount":
    case "endingSeen":
    case "newGamePlus":
    case "weekday":
    case "stringVariable":
      return actorQueryConditionSummary(condition);
    case "difficulty":
      return `난이도가 ${difficultyDisplayName(store.getCurrent().system, condition.difficultyId)}일 때`;
    case "itemUsed":
      return `${databaseRecordName("items", condition.itemId)}을(를) 이 이벤트에 사용했을 때`;
    case "all":
      return `(${condition.conditions.map(describeCondition).join(", ") || "조건 없음"}) 모두 맞을 때`;
    case "any":
      return `(${condition.conditions.map(describeCondition).join(", ") || "조건 없음"}) 하나라도 맞을 때`;
    case "not":
      return `(${describeCondition(condition.condition)}) 아닐 때`;
  }
}

function recordName(kind: "switch" | "variable", id: string): string {
  const records = kind === "switch" ? store.getCurrent().switches : store.getCurrent().variables;
  const record = records.find((candidate) => candidate.id === id);
  return record?.name.trim() || id || (kind === "switch" ? "스위치 선택" : "변수 선택");
}

function databaseRecordName(kind: "actors" | "items", id: string): string {
  const record = store.getCurrent().database[kind].find((candidate) => candidate.id === id);
  return record?.name.trim() || id || (kind === "actors" ? "주인공 선택" : "아이템 선택");
}

function comparison(op: "==" | ">=" | "<=" | ">" | "<" | "!=", value: number): string {
  switch (op) {
    case ">=":
      return `${value} 이상`;
    case "<=":
      return `${value} 이하`;
    case ">":
      return `${value} 초과`;
    case "<":
      return `${value} 미만`;
    case "==":
      return `${value}와 같을 때`;
    case "!=":
      return `${value}와 다를 때`;
  }
}

function timePhaseName(phase: Extract<Condition, { kind: "timePhase" }>["phase"]): string {
  return { morning: "아침", day: "낮", evening: "저녁", night: "밤" }[phase];
}

function seasonName(season: Extract<Condition, { kind: "season" }>["season"]): string {
  return { spring: "봄", summer: "여름", fall: "가을", winter: "겨울" }[season];
}

function battleResultName(result: Extract<Condition, { kind: "battleResult" }>["result"]): string {
  return { victory: "승리", defeat: "패배", escape: "도망" }[result];
}

function runConditionDescription(condition: Extract<Condition, { kind: "run" }>): string {
  switch (condition.query) {
    case "active":
      return `탐험이 ${condition.value === false ? "진행 중이 아닐 때" : "진행 중일 때"}`;
    case "floor":
      return `탐험 층 ${comparison(condition.op, condition.value)}`;
    case "flag":
      return `탐험 기억 ${condition.flag || "(없음)"} ${condition.value ? "켜짐" : "꺼짐"}`;
    case "result":
      return `탐험 결과 ${{ completed: "완료", failed: "실패", abandoned: "포기" }[condition.result]}일 때`;
  }
}

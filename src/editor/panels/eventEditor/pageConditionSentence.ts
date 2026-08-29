// 켜진 페이지 조건을 한 문장으로 되읽어 준다.
//
// 조건 12행을 다 채워도 "그래서 이 페이지는 언제 보이지?"는 저작자가 머릿속에서
// 조립해야 했다. 저장 직전에 눈으로 확인할 한 줄이 없었다.
//
// 문법 규칙 하나: **각 조각은 명사구로 끝난다.** 그래야 프레임의 "…일 때 보입니다"가
// 어떤 조각 뒤에 붙어도 자연스럽다 (켜짐→켜짐일 때, 낮→낮일 때, 100 이상→100 이상일 때).
// 동사 어간으로 만들면 "있"+"을 때"는 되지만 "낮이"+"을 때"가 깨져서, 조각마다
// 활용을 달리해야 한다. 명사구로 통일하면 활용 로직이 아예 없어도 된다.
import { ordinalLabel } from "@/editor/panels/databaseDisplay";
import { store } from "@/project/store";
import type { EventPageCondition, Project } from "@/project/types";

export type SentencePart = {
  /** value 조각은 저작자가 고른 값 — UI 가 강조한다. */
  readonly kind: "text" | "value";
  readonly text: string;
};

export type PageConditionSentence = {
  readonly text: string;
  readonly parts: readonly SentencePart[];
};

const PREFIX = "이 페이지는 ";
const SUFFIX = "일 때 보입니다.";
const ALL_MATCH = "이 모두 맞을 때 보입니다.";

export function pageConditionSentence(
  conditions: readonly EventPageCondition[],
  project: Project = store.getCurrent(),
): PageConditionSentence {
  if (conditions.length === 0) {
    const text = "이 페이지는 조건 없이 항상 보입니다.";
    return { text, parts: [{ kind: "text", text }] };
  }

  const parts: SentencePart[] = [{ kind: "text", text: PREFIX }];
  conditions.forEach((condition, index) => {
    if (index > 0) parts.push({ kind: "text", text: ", " });
    parts.push(...clauseParts(condition, project));
  });
  // 조건이 둘 이상이면 "모두 참"이라는 사실 자체가 정보다 — AND 인지 OR 인지 묻지 않게 한다.
  parts.push({ kind: "text", text: conditions.length > 1 ? ALL_MATCH : SUFFIX });

  return { text: parts.map((part) => part.text).join(""), parts };
}

function clauseParts(condition: EventPageCondition, project: Project): SentencePart[] {
  const value = (text: string): SentencePart => ({ kind: "value", text });
  const text = (raw: string): SentencePart => ({ kind: "text", text: raw });

  switch (condition.kind) {
    case "switch":
      return [value(quoted(recordLabel(project.switches, condition.switchId))),
        text(condition.value ? " 켜짐" : " 꺼짐")];
    case "variable":
      return [value(quoted(recordLabel(project.variables, condition.variableId))),
        text(` ${compareLabel(condition.op, condition.value)}`)];
    case "selfSwitch":
      return [text("이 이벤트 기억 "), value(condition.key),
        text(condition.value ? " 켜짐" : " 꺼짐")];
    case "actor":
      return [value(quoted(recordLabel(project.database.actors, condition.actorId))),
        text(condition.present ? " 파티에 있음" : " 파티에 없음")];
    case "item":
      return [value(quoted(recordLabel(project.database.items, condition.itemId))),
        text(condition.present ? " 보유 중" : " 보유 안 함")];
    case "gold":
      return [text("소지금 "), value(compareLabel(condition.op, condition.amount))];
    case "timer":
      return [text(`${condition.timerId === "timer1" ? "타이머 1" : "타이머 2"} `),
        value(durationLabel(condition.seconds)), text(" 이하")];
    case "timePhase":
      return [text("시간대 "), value(timePhaseLabel(condition.phase))];
    case "season":
      return [text("계절 "), value(seasonLabel(condition.season))];
    case "npcActivity":
      return [text("활동 "), value(condition.activity || "(없음)")];
    case "friendshipAtLeast":
      return [text(`${condition.npcKey?.trim() || "이 이벤트"} 호감도 `),
        value(`${condition.value} 이상`)];
    case "battleResult":
      return [text("전투 "), value(battleResultLabel(condition.result))];
    case "run":
      return runClauseParts(condition);
    case "all":
      return [text("하위 조건 "), value(`${condition.conditions.length}개 모두 참`)];
    case "any":
      return [text("하위 조건 "), value(`${condition.conditions.length}개 중 하나 참`)];
    case "not":
      return [text("다음이 아님: "), ...clauseParts(condition.condition, project)];
    default:
      // RoguelikeRunCondition 등 전용 편집기를 가진 조건. 종류만 밝히고 넘긴다 —
      // 문장이 그 조건을 없는 것처럼 읽히면 안 된다.
      return [text("특수 조건 "), value(String((condition as { kind: string }).kind))];
  }
}

/** 이름이 비었으면 번호로 부른다 — "「」 켜짐" 같은 빈 괄호를 만들지 않는다. */
function recordLabel(records: readonly { id: string; name: string }[], id: string): string {
  const index = records.findIndex((record) => record.id === id);
  if (index < 0) return id || "(선택 안 함)";
  return records[index]!.name.trim() || ordinalLabel(index);
}

function quoted(label: string): string {
  return `「${label}」`;
}

function compareLabel(op: string, amount: number): string {
  switch (op) {
    case ">=":
      return `${amount} 이상`;
    case "<=":
      return `${amount} 이하`;
    case ">":
      return `${amount} 초과`;
    case "<":
      return `${amount} 미만`;
    case "!=":
      return `${amount} 다름`;
    case "==":
      return `${amount} 같음`;
    default:
      return `${amount}`;
  }
}

function runClauseParts(condition: Extract<EventPageCondition, { kind: "run" }>): SentencePart[] {
  const value = (text: string): SentencePart => ({ kind: "value", text });
  const text = (raw: string): SentencePart => ({ kind: "text", text: raw });
  switch (condition.query) {
    case "active":
      return [text("탐험 "), value(condition.value === false ? "중이 아님" : "중")];
    case "floor":
      return [text("탐험 층 "), value(compareLabel(condition.op, condition.value))];
    case "flag":
      return [
        text("탐험 기억 "),
        value(quoted(condition.flag.trim() || "(없음)")),
        text(condition.value ? " 켜짐" : " 꺼짐"),
      ];
    case "result":
      return [text("탐험 결과 "), value(runResultLabel(condition.result))];
  }
}

function runResultLabel(result: "completed" | "failed" | "abandoned"): string {
  switch (result) {
    case "completed":
      return "완료";
    case "failed":
      return "실패";
    case "abandoned":
      return "포기";
  }
}

function durationLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  if (minutes === 0) return `${rest}초`;
  if (rest === 0) return `${minutes}분`;
  return `${minutes}분 ${rest}초`;
}

function timePhaseLabel(phase: Extract<EventPageCondition, { kind: "timePhase" }>["phase"]): string {
  switch (phase) {
    case "morning":
      return "아침";
    case "day":
      return "낮";
    case "evening":
      return "저녁";
    case "night":
      return "밤";
  }
}

function seasonLabel(season: Extract<EventPageCondition, { kind: "season" }>["season"]): string {
  switch (season) {
    case "spring":
      return "봄";
    case "summer":
      return "여름";
    case "fall":
      return "가을";
    case "winter":
      return "겨울";
  }
}

function battleResultLabel(result: "victory" | "defeat" | "escape"): string {
  switch (result) {
    case "victory":
      return "승리";
    case "defeat":
      return "패배";
    case "escape":
      return "도망";
  }
}

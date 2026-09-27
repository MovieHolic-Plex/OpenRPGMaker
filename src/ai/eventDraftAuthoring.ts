// ai/eventDraftAuthoring.ts
// 문장 하나 → **이벤트 한 개 전체**(이름·모습·시작 조건·페이지 여러 장) 초안. 브라우저 DOM 접근 금지.
//
// 왜 페이지 명령 작성기(eventCommandAssist)와 따로 있는가:
// 그 작성기는 "이 페이지의 명령 목록"만 돌려준다. 그래서 우클릭 「AI 로 이벤트 만들기」로 보물상자를
// 부탁하면 명령은 생겨도 그림·시작 조건·「이미 열었으면 비어 있다」 두 번째 페이지는 빈칸으로 남았다
// (그 작성기 프롬프트는 "페이지 분리는 이번 범위 밖"이라고 모델에게 말한다). 작업함은 이벤트를 통째로
// 받아야 「배치」 한 번으로 끝난다.
//
// 공유하는 것: 명령 사전·참조 id·리소스 목록(eventCommandCatalogSections)과 명령 검증 사슬
// (validateAssistCommandValue). 새로 정하는 것: 이벤트 겉모양 JSON 계약과 그 검증뿐이다.
//
// 동시 실행: 이 모듈은 전역 상태를 쓰지 않는다. 작업함은 같은 스냅샷으로 여러 개를 동시에 부른다.

import { searchResources } from "@/assets/resourceSearch";
import { validateConditionShape } from "@/project/io/shapeCommandFields";
import type {
  Command,
  EventPage,
  EventPageCondition,
  EventPageGraphic,
  EventPriority,
  GameEvent,
  MapId,
  Project,
  Trigger,
} from "@/project/types";
import { resolveSurfaceAiConfig } from "./assistantEndpoint";
import { eventCommandCatalogSections, validateAssistCommandValue } from "./eventCommandAssist";
import { chatCompletion, type AiConfig, type ChatMessage } from "./llmClient";
import { composeSystemPrompt } from "./systemPromptEnvelope";

/** 모델이 고를 수 있는 시작 방식. 매개변수가 필요한 구역 트리거는 이 표면에서 뺀다. */
const DRAFT_TRIGGERS = ["action", "playerTouch", "eventTouch", "auto", "parallel"] as const;
type DraftTriggerKind = (typeof DRAFT_TRIGGERS)[number];

const DRAFT_PRIORITIES: readonly EventPriority[] = ["below", "same", "above"];
const MAX_PAGES = 4;
const MAX_ATTEMPTS = 3;
/** 모습 후보는 프롬프트 예산 안에서만 싣는다. 검증은 카탈로그 전체로 한다. */
const MAX_GRAPHIC_CHOICES = 60;

export interface EventDraftRequest {
  readonly project: Project;
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly prompt: string;
}

/** 작업함 카드가 사람 말로 보여 줄 페이지 한 장 요약. */
export interface EventDraftPageSummary {
  readonly name: string;
  readonly graphicLabel: string;
  readonly triggerLabel: string;
  readonly conditionLabel: string;
  readonly commandCount: number;
}

export interface EventDraft {
  /** 좌표·id 가 아직 없는 이벤트. 배치할 때 작업함이 id 와 좌표를 채운다. */
  readonly event: Omit<GameEvent, "id" | "x" | "y">;
  readonly title: string;
  readonly pages: readonly EventDraftPageSummary[];
}

export interface EventDraftResult extends EventDraft {
  readonly attempts: number;
}

export type EventDraftParseResult =
  | { readonly ok: true; readonly draft: EventDraft }
  | { readonly ok: false; readonly errors: readonly string[] };

const TRIGGER_WORDS: Readonly<Record<DraftTriggerKind, string>> = {
  action: "조사하면",
  playerTouch: "밟으면",
  eventTouch: "닿으면",
  auto: "자동 실행",
  parallel: "병렬 실행",
};

type GraphicChoice = { readonly id: string; readonly label: string; readonly graphic: EventPageGraphic };

function graphicChoices(project: Project): readonly GraphicChoice[] {
  return searchResources("charset", "*", { charsetLabels: project.charsetLabels })
    .flatMap((hit) => (hit.nativeGraphic ? [{ id: hit.id, label: hit.label, graphic: hit.nativeGraphic }] : []));
}

/** 요청과 관련 있는 모습을 앞에 세운다 — 전체 목록 머리 60칸만 자르면 늘 사람 그림만 보인다. */
function promptGraphicChoices(project: Project, prompt: string): readonly GraphicChoice[] {
  const all = graphicChoices(project);
  const words = prompt.split(/[\s,.!?«»"'()·]+/u).filter((word) => word.length >= 2);
  const related = new Set<string>();
  for (const word of words) {
    for (const hit of searchResources("charset", word, { charsetLabels: project.charsetLabels }).slice(0, 6)) related.add(hit.id);
  }
  const ordered = [...all.filter((choice) => related.has(choice.id)), ...all.filter((choice) => !related.has(choice.id))];
  return ordered.slice(0, MAX_GRAPHIC_CHOICES);
}

export function buildEventDraftPrompt(request: EventDraftRequest): string {
  const { project, mapId, x, y } = request;
  const map = project.maps[mapId];
  const catalog = eventCommandCatalogSections(project, mapId, request.prompt);
  const neighbours = (map?.events ?? [])
    .filter((event) => Math.abs(event.x - x) <= 4 && Math.abs(event.y - y) <= 4)
    .slice(0, 8)
    .map((event) => "- " + (event.name?.trim() || event.id) + " (" + event.x + "," + event.y + ")");
  const sections: string[] = [
    [
      "당신은 브라우저 기반 2D RPG 에디터의 이벤트 저작자입니다.",
      "사용자의 한 문장을 **이벤트 한 개 전체**로 만듭니다: 이름, 모습, 시작 방식, 페이지(상태)별 명령.",
      "",
      "현재 위치: 맵 \"" + (map?.name ?? mapId) + "\"(" + mapId + "), 칸 (" + x + ", " + y + ")"
        + (map ? ", 맵 크기 " + map.width + "×" + map.height : ""),
      neighbours.length > 0 ? "근처 이벤트:\n" + neighbours.join("\n") : "근처 이벤트: 없음",
    ].join("\n"),
    ...catalog.head,
    [
      "## 모습(graphic) id — 반드시 아래 id 중 하나 또는 \"none\"(투명)",
      ...promptGraphicChoices(project, request.prompt).map((choice) => "- " + choice.id + ": " + choice.label),
    ].join("\n"),
    catalog.resources,
    [
      "## 페이지와 상태",
      "- 페이지는 위에서 아래 순서다. 런타임은 **조건이 맞는 마지막 페이지**를 실행한다.",
      "- 「한 번만」·「이미 열었으면」 같은 상태는 첫 페이지 끝에서 setSelfSwitch(key A, value true)로 켜고,",
      "  두 번째 페이지에 conditions:[{\"kind\":\"selfSwitch\",\"key\":\"A\",\"value\":true}] 를 둔다.",
      "- 셀프 스위치는 이 이벤트 전용이라 다른 이벤트와 겹치지 않는다. 전역 스위치를 새로 지어내지 마라.",
      "- 페이지는 최대 " + MAX_PAGES + "장.",
    ].join("\n"),
    [
      "## 출력 규약(반드시 준수)",
      "1. 출력은 JSON 객체 하나뿐이다. 설명·주석 금지. ```json 펜스는 허용.",
      "2. 모양: {\"name\":string, \"pages\":[{\"name\":string, \"graphic\":<모습 id 또는 \"none\">, \"trigger\":\"action\"|\"playerTouch\"|\"eventTouch\"|\"auto\"|\"parallel\", \"priority\":\"below\"|\"same\"|\"above\", \"conditions\":[<Condition>...], \"commands\":[<Command>...]}]}",
      "3. 사물·NPC 처럼 부딪히는 것은 priority \"same\", 바닥 장치는 \"below\".",
      "4. commands 원소는 위 Command 스키마를 따른다. id 는 목록에 있는 것만 쓴다.",
      "5. 요청이 모호하면 가장 단순하고 안전한 해석으로 만든다.",
    ].join("\n"),
  ];
  return sections.join("\n\n");
}

function extractJsonObjectText(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return body.slice(start, end + 1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function conditionWords(conditions: readonly EventPageCondition[]): string {
  return conditions.map((condition) => {
    if (condition.kind === "selfSwitch") return "이 이벤트 기억 " + condition.key + (condition.value ? " 켜짐" : " 꺼짐");
    if (condition.kind === "switch") return "스위치 " + condition.switchId + (condition.value ? " 켜짐" : " 꺼짐");
    if (condition.kind === "item") return "아이템 " + condition.itemId + (condition.present ? " 있음" : " 없음");
    return condition.kind;
  }).join(" · ");
}

/** 모델 응답 JSON 을 검증된 이벤트 초안으로 바꾼다. 실패는 자가수정 루프가 읽을 문장으로 돌려준다. */
export function parseEventDraft(project: Project, mapId: MapId, text: string): EventDraftParseResult {
  const jsonText = extractJsonObjectText(text);
  if (!jsonText) return { ok: false, errors: ["응답에서 JSON 객체를 찾지 못했습니다. 이벤트 JSON 객체 하나만 출력하세요."] };
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch (cause) {
    return { ok: false, errors: ["JSON 파싱 실패: " + (cause instanceof Error ? cause.message : String(cause))] };
  }
  if (!isRecord(raw)) return { ok: false, errors: ["최상위 값이 객체가 아닙니다."] };
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 40) : "";
  if (!name) return { ok: false, errors: ["name(이벤트 이름)이 비었습니다."] };
  if (!Array.isArray(raw.pages) || raw.pages.length === 0) return { ok: false, errors: ["pages 배열이 비었습니다. 페이지를 1장 이상 만드세요."] };
  if (raw.pages.length > MAX_PAGES) return { ok: false, errors: ["페이지가 " + raw.pages.length + "장입니다. 최대 " + MAX_PAGES + "장으로 줄이세요."] };

  const choices = new Map(graphicChoices(project).map((choice) => [choice.id, choice]));
  const errors: string[] = [];
  const pages: EventPage[] = [];
  const summaries: EventDraftPageSummary[] = [];
  raw.pages.forEach((value, index) => {
    const label = "pages[" + index + "]";
    if (!isRecord(value)) {
      errors.push(label + " 가 객체가 아닙니다.");
      return;
    }
    const triggerKind = typeof value.trigger === "string" ? value.trigger : "action";
    if (!(DRAFT_TRIGGERS as readonly string[]).includes(triggerKind)) {
      errors.push(label + ".trigger «" + triggerKind + "» 는 쓸 수 없습니다. " + DRAFT_TRIGGERS.join("/") + " 중 하나.");
      return;
    }
    const priority = (typeof value.priority === "string" ? value.priority : "same") as EventPriority;
    if (!DRAFT_PRIORITIES.includes(priority)) {
      errors.push(label + ".priority «" + String(value.priority) + "» 는 below/same/above 중 하나여야 합니다.");
      return;
    }
    const graphicId = typeof value.graphic === "string" ? value.graphic.trim() : "none";
    let graphic: EventPageGraphic = { transparent: true };
    let graphicLabel = "투명";
    if (graphicId && graphicId !== "none") {
      const choice = choices.get(graphicId);
      if (!choice) {
        errors.push(label + ".graphic «" + graphicId + "» 는 모습 목록에 없습니다. 목록의 id 또는 \"none\" 을 쓰세요.");
        return;
      }
      graphic = structuredClone(choice.graphic);
      graphicLabel = choice.label;
    }
    const conditions: EventPageCondition[] = [];
    const rawConditions = Array.isArray(value.conditions) ? value.conditions : [];
    for (const [conditionIndex, condition] of rawConditions.entries()) {
      try {
        validateConditionShape(label + ".conditions[" + conditionIndex + "]", condition);
        conditions.push(condition as EventPageCondition);
      } catch (cause) {
        errors.push(cause instanceof Error ? cause.message : String(cause));
      }
    }
    const commands = validateAssistCommandValue(project, value.commands ?? [], { allowEmpty: index > 0, mapId });
    if (!commands.ok) {
      errors.push(...commands.errors.map((error) => label + ".commands: " + error));
      return;
    }
    const trigger = { kind: triggerKind } as Trigger;
    const pageName = typeof value.name === "string" && value.name.trim() ? value.name.trim().slice(0, 40) : "페이지 " + (index + 1);
    pages.push({
      id: "page_draft_" + index,
      name: pageName,
      conditions,
      graphic,
      trigger,
      priority,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: commands.commands as Command[],
    });
    summaries.push({
      name: pageName,
      graphicLabel,
      triggerLabel: TRIGGER_WORDS[triggerKind as DraftTriggerKind],
      conditionLabel: conditionWords(conditions),
      commandCount: commands.commands.length,
    });
  });
  if (errors.length > 0) return { ok: false, errors };
  const first = pages[0]!;
  return {
    ok: true,
    draft: {
      title: name,
      pages: summaries,
      event: { name, trigger: first.trigger, commands: [], pages },
    },
  };
}

/** 한 문장 → 검증된 이벤트 초안. 검증 실패는 오류를 되돌려 최대 두 번 스스로 고친다. */
export async function runEventDraftAuthoring(options: {
  readonly config: AiConfig;
  readonly request: EventDraftRequest;
  readonly chat?: typeof chatCompletion;
  readonly signal?: AbortSignal;
  readonly projectScopeKey?: string;
}): Promise<EventDraftResult> {
  const { request, signal } = options;
  const config = resolveSurfaceAiConfig("event-command", options.config);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: composeSystemPrompt({
        surface: "event-command",
        body: buildEventDraftPrompt(request),
        includeMemory: true,
        ...(options.projectScopeKey ? { projectScopeKey: options.projectScopeKey } : {}),
      }),
    },
    { role: "user", content: request.prompt },
  ];
  let lastErrors: readonly string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    signal?.throwIfAborted();
    const result = await (options.chat ?? chatCompletion)(config, { messages, signal });
    const content = typeof result.message.content === "string" ? result.message.content : "";
    const parsed = parseEventDraft(request.project, request.mapId, content);
    if (parsed.ok) return { ...parsed.draft, attempts: attempt };
    lastErrors = parsed.errors;
    messages.push(
      { role: "assistant", content },
      { role: "user", content: ["검증에 실패했습니다. 아래 오류를 고쳐 규약에 맞는 JSON 객체만 다시 출력하세요.", ...parsed.errors.map((error) => "- " + error)].join("\n") },
    );
  }
  throw new Error("이벤트를 만들지 못했어요(" + MAX_ATTEMPTS + "회 시도): " + lastErrors.join(" / "));
}

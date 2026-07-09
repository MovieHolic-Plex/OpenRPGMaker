// ai/eventCommandAssist.ts
// 이벤트 명령 AI Assist 순수 로직(브라우저 DOM 접근 금지).
// 자연어 요청 → LLM(chatCompletion) → 커맨드 JSON 배열 파싱/검증 → 실패 시 최대 2회 자가수정.
//
// - 프롬프트: commandKindRegistry의 kind 목록 + eventCommandFactory.newCommand 기본값을
//   JSON 예시로 "자동 직렬화"해 포함한다(수기 중복 정의 금지 — 스키마 드리프트 방지).
// - 검증: io/shapeCommandFields.validateCommandArray(구조) + io/commandReferenceValidation(참조).
// - 범위: "커맨드 배열 생성"만. 페이지 분리/조건 편집은 다루지 않는다.

import { newCommand } from "@/editor/eventCommandFactory";
import { COMMAND_KINDS } from "@/project/commandKindRegistry";
import {
  validateCommands,
  type ReferenceContext,
} from "@/project/io/commandReferenceValidation";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { chatCompletion, configForLiteModel, type AiConfig, type ChatMessage } from "./llmClient";

export interface EventAssistContext {
  readonly project: Project;
  readonly mapId: string;
  readonly event?: GameEvent;
  readonly page?: EventPage;
  // 현재 커맨드 리스트에서 선택된 경로(있으면 "이 위치 뒤에 삽입될 것"임을 모델에 알린다).
  readonly selection?: readonly number[] | null;
}

export type AssistParseResult =
  | { readonly ok: true; readonly commands: Command[] }
  | { readonly ok: false; readonly errors: string[] };

export interface AssistRunResult {
  readonly commands: Command[];
  // 성공까지 사용한 LLM 호출 횟수(1=한 번에 성공).
  readonly attempts: number;
}

// 프롬프트에 나열하는 참조 목록 상한(초과분은 생략 안내).
const MAX_REF_ENTRIES = 40;
// 기존 커맨드 요약 문자 상한.
const MAX_EXISTING_CHARS = 2000;
// 최초 1회 + 자가수정 2회.
const MAX_ATTEMPTS = 3;

// m2Command는 카탈로그 id 의존이라 AI 생성 대상에서 제외한다.
const EXCLUDED_KINDS: ReadonlySet<string> = new Set(["m2Command"]);

// ── 프롬프트 조립 ────────────────────────────────────────────────────────────

// newCommand 기본값들을 그대로 직렬화한 kind별 JSON 예시(단일 진실 소스 유지).
function commandExampleLines(): string[] {
  return COMMAND_KINDS.filter((kind) => !EXCLUDED_KINDS.has(kind)).map(
    (kind) => `- ${kind}: ${JSON.stringify(newCommand(kind))}`
  );
}

function refSection(title: string, entries: readonly { id: string; name: string }[]): string {
  const shown = entries.slice(0, MAX_REF_ENTRIES);
  const lines = shown.map((entry) => `- ${entry.id}: ${entry.name || "(이름 없음)"}`);
  if (entries.length > shown.length) {
    lines.push(`- …외 ${entries.length - shown.length}개 생략(위 목록의 id만 사용)`);
  }
  return [`### ${title}`, ...(lines.length ? lines : ["- (없음 — 이 종류를 참조하는 커맨드를 만들지 말 것)"])].join("\n");
}

function existingCommandsSection(page: EventPage | undefined): string {
  if (!page || page.commands.length === 0) return "## 현재 페이지의 기존 커맨드\n(없음)";
  let json = JSON.stringify(page.commands);
  if (json.length > MAX_EXISTING_CHARS) json = `${json.slice(0, MAX_EXISTING_CHARS)}…(생략)`;
  return ["## 현재 페이지의 기존 커맨드", "```json", json, "```"].join("\n");
}

export function buildEventAssistPrompt(context: EventAssistContext): string {
  const { project, mapId, event, page, selection } = context;
  const mapName = project.maps[mapId]?.name ?? mapId;
  const sections: string[] = [];

  sections.push(
    [
      "당신은 브라우저 기반 2D RPG 에디터(RPG ZZU)의 이벤트 명령 생성기입니다.",
      "사용자의 자연어 요청을 이벤트 커맨드(Command) JSON 배열로 변환합니다.",
      "",
      `현재 위치: 맵 "${mapName}"(${mapId})` +
        (event ? `, 이벤트 ${event.id} (${event.x}, ${event.y})` : "") +
        (page ? `, 페이지 "${page.name || page.id}"` : ""),
      selection && selection.length > 0
        ? `생성된 커맨드는 현재 선택된 커맨드(경로 ${JSON.stringify(selection)}) 뒤에 삽입됩니다.`
        : "생성된 커맨드는 페이지 커맨드 목록 끝에 추가됩니다.",
    ].join("\n")
  );

  sections.push(
    [
      "## Command 스키마",
      `사용 가능한 kind: ${COMMAND_KINDS.filter((kind) => !EXCLUDED_KINDS.has(kind)).join(", ")}`,
      "",
      "kind별 기본값 JSON 예시(필드 구조 참고 — 값은 요청에 맞게 채울 것):",
      ...commandExampleLines(),
      "",
      "중첩 규칙:",
      '- fork: {"kind":"fork","condition":<Condition>,"then":[<Command>...],"else":[<Command>...]} (else는 선택).',
      '- Condition 종류: {"kind":"switch","switchId","value"} / {"kind":"variable","variableId","op","value"} / {"kind":"selfSwitch","key":"A"~"D","value"} / {"kind":"item","itemId","present"} / {"kind":"actor","actorId","present"} / {"kind":"gold","op","amount"} / {"kind":"timer","timerId","seconds"}.',
      "- choices: options[].branch, cancelBranch에 커맨드 배열 중첩 가능.",
      "- loop: body에 커맨드 배열 중첩 가능. breakLoop로 탈출.",
      "- 셀프 스위치 분기는 fork의 selfSwitch 조건을 사용한다(페이지 분리는 이번 범위 밖).",
    ].join("\n")
  );

  sections.push(
    [
      "## 참조 가능한 리소스(반드시 아래 id를 그대로 사용 — 이름/추측 id 금지)",
      refSection("스위치", project.switches),
      refSection("변수", project.variables),
      refSection("아이템", project.database.items),
      refSection("트룹(적 그룹)", project.database.troops),
      refSection("액터", project.database.actors),
      refSection(
        "맵",
        Object.entries(project.maps).map(([id, map]) => ({ id, name: map.name }))
      ),
    ].join("\n")
  );

  sections.push(existingCommandsSection(page));

  sections.push(
    [
      "## 출력 규약(반드시 준수)",
      "1. 출력은 **커맨드 JSON 배열 하나**뿐이다. 설명·주석·여는 말 금지. ```json 펜스는 허용.",
      "2. 각 원소는 위 스키마의 Command 객체여야 한다.",
      "3. switchId/variableId/itemId/troopId/actorId/mapId는 반드시 위 목록의 id를 사용한다.",
      "4. playAudio/showPicture/changeFace 등 resourceId가 필요한 커맨드와 m2Command는 사용하지 않는다.",
      "5. 요청이 모호하면 가장 단순하고 안전한 해석으로 생성한다.",
    ].join("\n")
  );

  return sections.join("\n\n");
}

// ── 파싱 + 검증 ──────────────────────────────────────────────────────────────

// 응답 텍스트에서 JSON 배열 텍스트만 추출(```json 펜스 제거, 앞뒤 잡담 무시).
function extractJsonArrayText(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  return body.slice(start, end + 1);
}

function buildReferenceContext(project: Project): ReferenceContext {
  return {
    actorIds: new Set(project.database.actors.map((record) => record.id)),
    classIds: new Set(project.database.classes.map((record) => record.id)),
    enemyIds: new Set(project.database.enemies.map((record) => record.id)),
    itemIds: new Set(project.database.items.map((record) => record.id)),
    equipmentIds: new Set(project.database.equipment.map((record) => record.id)),
    skillIds: new Set(project.database.skills.map((record) => record.id)),
    animationIds: new Set(project.database.battleAnimations.map((record) => record.id)),
    switchIds: new Set(project.switches.map((record) => record.id)),
    variableIds: new Set(project.variables.map((record) => record.id)),
    commonEventIds: new Set(project.commonEvents.map((record) => record.id)),
    endingIds: new Set((project.endings ?? []).map((record) => record.id)),
    mapIds: new Set(Object.keys(project.maps)),
    troopIds: new Set(project.database.troops.map((record) => record.id)),
    speciesIds: new Set((project.database.monsterSpecies ?? []).map((record) => record.id)),
    resourceIds: collectResourceIds(project),
  };
}

export function parseAndValidate(project: Project, text: string): AssistParseResult {
  const jsonText = extractJsonArrayText(text);
  if (!jsonText) {
    return { ok: false, errors: ["응답에서 JSON 배열을 찾지 못했습니다. 커맨드 JSON 배열만 출력하세요."] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (cause) {
    return { ok: false, errors: [`JSON 파싱 실패: ${cause instanceof Error ? cause.message : String(cause)}`] };
  }
  if (!Array.isArray(parsed)) return { ok: false, errors: ["최상위 값이 배열이 아닙니다."] };
  if (parsed.length === 0) return { ok: false, errors: ["빈 배열입니다. 요청에 맞는 커맨드를 1개 이상 생성하세요."] };

  // 1) 구조(shape) 검증 — 알 수 없는 kind/필드 타입 오류를 잡는다.
  try {
    validateCommandArray("commands", parsed);
  } catch (cause) {
    return { ok: false, errors: [cause instanceof Error ? cause.message : String(cause)] };
  }
  const commands = parsed as Command[];

  // 2) 참조 검증 — 존재하지 않는 itemId/switchId 등을 잡는다.
  const referenceContext = buildReferenceContext(project);
  try {
    validateCommands(commands, referenceContext);
    // io 검증이 다루지 않는 참조 보강(changeItem.itemId / changeParty.actorId).
    validateSupplementalReferences(commands, referenceContext);
  } catch (cause) {
    return { ok: false, errors: [cause instanceof Error ? cause.message : String(cause)] };
  }
  return { ok: true, commands };
}

// io/commandReferenceValidation이 커버하지 않는 참조를 중첩 포함해 검증한다.
function validateSupplementalReferences(commands: readonly Command[], context: ReferenceContext): void {
  for (const command of commands) {
    switch (command.kind) {
      case "changeItem":
        if (!context.itemIds.has(command.itemId)) {
          throw new Error(`changeItem: itemId가 존재하지 않습니다: ${command.itemId}`);
        }
        break;
      case "changeParty":
        if (!context.actorIds.has(command.actorId)) {
          throw new Error(`changeParty: actorId가 존재하지 않습니다: ${command.actorId}`);
        }
        break;
      case "fork":
        validateSupplementalReferences(command.then, context);
        validateSupplementalReferences(command.else ?? [], context);
        break;
      case "choices":
        for (const option of command.options) validateSupplementalReferences(option.branch, context);
        validateSupplementalReferences(command.cancelBranch ?? [], context);
        break;
      case "loop":
        validateSupplementalReferences(command.body, context);
        break;
      case "shop":
        validateSupplementalReferences(command.transactionBranch ?? [], context);
        break;
      default:
        break;
    }
  }
}

// ── 실행 루프(검증 실패 시 자가수정) ─────────────────────────────────────────

export async function runEventCommandAssist(options: {
  readonly config: AiConfig;
  readonly prompt: string;
  readonly context: EventAssistContext;
  readonly onDelta?: (delta: string) => void;
  readonly signal?: AbortSignal;
}): Promise<AssistRunResult> {
  const { prompt, context, onDelta, signal } = options;
  const config = configForLiteModel(options.config);
  const messages: ChatMessage[] = [
    { role: "system", content: buildEventAssistPrompt(context) },
    { role: "user", content: prompt },
  ];

  let lastErrors: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = await chatCompletion(config, {
      messages,
      stream: Boolean(onDelta),
      onToken: onDelta,
      signal,
    });
    // assistant 응답은 항상 문자열 content다(멀티모달 파트는 비전 주입 user 메시지 전용).
    const content = typeof result.message.content === "string" ? result.message.content : "";
    const parsed = parseAndValidate(context.project, content);
    if (parsed.ok) return { commands: parsed.commands, attempts: attempt };

    lastErrors = parsed.errors;
    // 자가수정: 직전 응답 + 검증 에러를 되돌려 재생성 요청.
    messages.push(
      { role: "assistant", content },
      {
        role: "user",
        content: [
          "생성 결과 검증에 실패했습니다. 아래 오류를 고쳐 규약에 맞는 JSON 배열만 다시 출력하세요.",
          ...parsed.errors.map((error) => `- ${error}`),
        ].join("\n"),
      }
    );
  }
  throw new Error(`AI 커맨드 생성 실패(${MAX_ATTEMPTS}회 시도): ${lastErrors.join(" / ")}`);
}

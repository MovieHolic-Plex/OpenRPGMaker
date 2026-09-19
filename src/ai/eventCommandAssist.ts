// ai/eventCommandAssist.ts
// 이벤트 명령 AI Assist 순수 로직(브라우저 DOM 접근 금지).
// 자연어 요청 → LLM(chatCompletion) → 커맨드 JSON 배열 파싱/검증 → 실패 시 최대 2회 자가수정.
//
// - 프롬프트: commandKindRegistry의 kind 목록 + eventCommandFactory.newCommand 기본값을
//   JSON 예시로 "자동 직렬화"해 포함한다(수기 중복 정의 금지 — 스키마 드리프트 방지).
// - 검증: io/shapeCommandFields.validateCommandArray(구조) + io/commandReferenceValidation(참조).
//
// 출력 계약: 기본은 **페이지의 고친 뒤 최종 목록 전체**("page" scope)다. 예전에는 "새로 붙일
// 명령만" 이었고 반영도 삽입뿐이라, 사용자가 "이미 열었으면 비어있다고 하게 고쳐" 라고 쓰면
// 모델이 페이지를 다시 써서 돌려주고 앱은 그걸 끝에 덧붙여 **이벤트가 두 번 실행**됐다.
// 최종 목록을 받으면 고치기·지우기·순서 바꾸기가 전부 표현되고, 무엇이 달라졌는지는
// panels/eventEditor/commandDiff.ts 가 계산한다.
//
// 기존 목록이 컨텍스트 예산에 안 들어가면 "append" scope 로 내려간다 — 전체를 못 보여준
// 상태로 최종 목록을 받으면 모델이 못 본 명령을 지워버린다.

import { newCommand } from "@/editor/eventCommandFactory";
import { commandOwnFieldSignature } from "@/editor/panels/eventEditor/commandDiff";
import { commandBranches } from "@/editor/tools/commandTraversal";
import { isPassableLanding } from "@/project/collision";
import { resolvePictureSource } from "@/player/pictures/pictureResources";
import { COMMAND_KINDS } from "@/project/commandKindRegistry";
import { COMMAND_GUARANTEES } from "@/project/commandGuaranteeRegistry";
import {
  buildEventTargetCatalog,
  moveTargetIssueMessage,
  moveTargetPromptSection,
  resolveMoveTarget,
  type EventTargetCatalog,
} from "@/project/eventTargetCatalog";
import {
  validateCommands,
  type ReferenceContext,
} from "@/project/io/commandReferenceValidation";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import type { Command, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { resolveSurfaceAiConfig } from "./assistantEndpoint";
import { eventAudioPromptSection } from "./eventAudioPrompt";
import {
  EVENT_RESOURCE_SLOT_LABELS,
  eventResourceIdSet,
  listEventResourceOptions,
  type EventResourceSlot,
} from "./eventResourceCatalog";
import { chatCompletion, type AiConfig, type ChatMessage } from "./llmClient";
import { composeSystemPrompt } from "./systemPromptEnvelope";
import { findWorldCanonAbsenceHits, worldCanonPromptSection } from "./worldCanonContext";

export interface EventAssistContext {
  readonly project: Project;
  readonly mapId: string;
  readonly requestText?: string;
  readonly event?: GameEvent;
  readonly page?: EventPage;
  // 현재 커맨드 리스트에서 선택된 경로. 선택 **여부**만 쓴다 — 경로 배열 자체는
  // [명령index, 분기index(음수 센티널), …] 교대 인코딩이라 모델이 읽을 수 없다.
  readonly selection?: readonly number[] | null;
  // 선택된 명령을 사람 말로 옮긴 라벨(호출자가 commandSummary 로 만든다). 있으면 이걸 싣는다.
  readonly selectionLabel?: string;
}

/** "page" = 고친 뒤 최종 목록 전체 / "append" = 뒤에 붙일 새 명령만. */
export type AssistScope = "page" | "append";

export type AssistParseResult =
  | { readonly ok: true; readonly commands: Command[] }
  | { readonly ok: false; readonly errors: string[] };

export interface AssistRunResult {
  readonly commands: Command[];
  // scope 가 "page" 면 페이지 최종 목록, "append" 면 뒤에 붙일 새 명령만.
  readonly scope: AssistScope;
  // 성공까지 사용한 LLM 호출 횟수(1=한 번에 성공).
  readonly attempts: number;
}

// 프롬프트에 나열하는 참조 목록 상한(초과분은 생략 안내).
const MAX_REF_ENTRIES = 40;
// 기존 커맨드를 **온전한 JSON 으로** 실을 수 있는 상한. 넘으면 잘라 싣지 않고 append 로 내려간다
// (예전에는 2000자에서 문자열 중간을 자르고 "…(생략)" 을 붙여, 모델이 닫히지 않은 JSON 을 봤다).
const MAX_EXISTING_CHARS = 12000;
// 최초 1회 + 자가수정 2회.
const MAX_ATTEMPTS = 3;
// 이동 대상 맵의 중앙에서 시작해 전체 맵을 훑는다. 일부만 보고 "착지 칸 없음"으로
// 물러서면 멀리 정상 칸이 있는 맵의 함정 좌표를 검증 없이 통과시키기 때문이다.
// 리소스 명령을 숨기면 얼굴·소리 같은 일급 저작 기능을 잃는다. 대신 **종류별** id 목록을
// 프롬프트에 싣고(eventResourceCatalog) 같은 집합으로 kind 별 검증을 걸어, 잘못 고른 id 는
// 자가수정 루프가 다시 고치게 한다.
const AI_SURFACE_KINDS = COMMAND_KINDS.filter(
  (kind) => COMMAND_GUARANTEES[kind].authoringSurfaces.includes("ai"),
);

// 어떤 kind 가 어떤 리소스 종류를 요구하는가. 프롬프트 절·검증·kind 노출이 이 표 하나를 본다.
const RESOURCE_SLOTS_BY_KIND = {
  changeFace: ["faceset"],
  playAudio: ["music", "sound"],
  showPicture: ["picture"],
  playMovie: ["movie"],
} as const satisfies Partial<Record<Command["kind"], readonly EventResourceSlot[]>>;

type ResourceBoundKind = keyof typeof RESOURCE_SLOTS_BY_KIND;

function isResourceBoundKind(kind: string): kind is ResourceBoundKind {
  return kind in RESOURCE_SLOTS_BY_KIND;
}

/**
 * 이 프로젝트에서 실제로 쓸 수 있는 kind 목록.
 *
 * 고를 리소스가 하나도 없는 kind 는 **뺀다**. 특히 동영상은 업로드로만 들어오므로 블랭크
 * 프로젝트에서는 playMovie 가 만들어 낼 수 있는 모든 값이 구조적으로 틀린다 — 목록에 실으면
 * 모델이 id 를 발명하고 자가수정 루프가 3회를 태운 뒤 실패한다. 하드코딩이 아니라 프로젝트를
 * 보고 정한다.
 */
export function aiCommandKinds(project: Project): readonly Command["kind"][] {
  return AI_SURFACE_KINDS.filter((kind) => {
    if (!isResourceBoundKind(kind)) return true;
    return RESOURCE_SLOTS_BY_KIND[kind].some(
      (slot) => listEventResourceOptions(slot, project).length > 0,
    );
  });
}

// ── 프롬프트 조립 ────────────────────────────────────────────────────────────

// newCommand 기본값들을 그대로 직렬화한 kind별 JSON 예시(단일 진실 소스 유지).
function commandExampleLines(kinds: readonly Command["kind"][]): string[] {
  return kinds.map(
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

// 이동 대상 맵은 크기만으로 부족하다 — 모델이 (0,0) 처럼 "안전해 보이는" 좌표를 쓰는데
// 실내 맵의 (0,0) 은 거의 항상 벽이라 플레이어가 벽 안에서 시작한다. 실제로 밟을 수 있는
// 칸 하나를 같이 실어 준다. 중앙부터 전체 맵을 훑어, 멀리 정상 칸이 있는데도 검증의
// 안전 밸브가 켜지는 일을 막는다.
function suggestedLandingCell(project: Project, map: GameMap): { x: number; y: number } | null {
  const centerX = Math.floor(map.width / 2);
  const centerY = Math.floor(map.height / 2);
  const maxRadius = Math.max(map.width, map.height);
  for (let radius = 0; radius < maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = centerX + dx;
        const y = centerY + dy;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        if (isPassableLanding(project, map, x, y)) return { x, y };
      }
    }
  }
  return null;
}

function mapReferenceLabel(project: Project, mapId: string, map: GameMap): string {
  const size = `가로 ${map.width} × 세로 ${map.height}`;
  const landing = suggestedLandingCell(project, map);
  const landingNote = landing
    ? `, 밟을 수 있는 칸 예: x=${landing.x} y=${landing.y}`
    : "";
  return `${map.name || mapId} (${size}${landingNote})`;
}

/**
 * 리소스 id 는 **종류별로** 싣는다. 한 덩어리로 실으면 상한 40개가 칩셋·아이콘으로
 * 차버리고 얼굴·소리·그림 id 는 하나도 보이지 않는다(직전 구현이 그랬다: 1851개 중 앞
 * 40개가 전부 tex_* / cc0-jetrel-*). 지금 노출된 kind 가 쓰는 종류만 실어 프롬프트 예산을
 * 지킨다. 오디오는 요청별 후보를 선별하고, 나머지는 refSection으로 자른다.
 */
function resourceSlotSection(
  project: Project,
  kinds: readonly Command["kind"][],
  requestText: string,
): string {
  const slots: EventResourceSlot[] = [];
  for (const kind of kinds) {
    if (!isResourceBoundKind(kind)) continue;
    for (const slot of RESOURCE_SLOTS_BY_KIND[kind]) {
      if (!slots.includes(slot)) slots.push(slot);
    }
  }
  if (slots.length === 0) return "## 리소스 id (이 프로젝트에는 고를 리소스가 없다)";

  const usage: string[] = [];
  for (const kind of kinds) {
    if (!isResourceBoundKind(kind)) continue;
    const labels = RESOURCE_SLOTS_BY_KIND[kind].map((slot) => EVENT_RESOURCE_SLOT_LABELS[slot]);
    usage.push(`- ${kind}.resourceId \u2190 ${labels.join(" 또는 ")} 목록에서만 고른다.`);
  }

  return [
    "## 리소스 id (종류가 다른 리소스를 섞어 쓰면 반려된다)",
    ...usage,
    ...slots.map((slot) => {
      switch (slot) {
        case "music":
        case "sound":
          return eventAudioPromptSection(slot, project, requestText);
        case "faceset":
        case "picture":
        case "movie":
          return refSection(
            `${EVENT_RESOURCE_SLOT_LABELS[slot]} id`,
            listEventResourceOptions(slot, project).map((option) => ({ id: option.id, name: option.name })),
          );
        default: {
          const unexpected: never = slot;
          throw new TypeError(`Unexpected event resource slot: ${unexpected}`);
        }
      }
    }),
  ].join("\n");
}

/** 기존 목록을 온전한 JSON 으로 실을 수 있으면 "page", 아니면 "append". */
export function resolveAssistScope(page: EventPage | undefined): AssistScope {
  if (!page || page.commands.length === 0) return "page";
  return JSON.stringify(page.commands).length <= MAX_EXISTING_CHARS ? "page" : "append";
}

function existingCommandsSection(page: EventPage | undefined, scope: AssistScope): string {
  if (!page || page.commands.length === 0) {
    return ["## 현재 페이지의 기존 커맨드", "(없음 — 빈 페이지다)"].join("\n");
  }
  if (scope === "append") {
    // 본문을 못 실었다는 사실을 분명히 적는다. 안 그러면 모델이 "안 보이는 건 없는 것"으로
    // 취급해 최종 목록에서 빠뜨린다.
    return [
      "## 현재 페이지의 기존 커맨드",
      `총 ${page.commands.length}개가 이미 있다. 너무 길어서 본문을 싣지 못했다.`,
      "기존 명령은 손대지 말고, 뒤에 붙일 새 명령만 만들어라.",
    ].join("\n");
  }
  return [
    "## 현재 페이지의 기존 커맨드(이 목록을 고쳐서 최종 목록을 돌려줄 것)",
    "```json",
    JSON.stringify(page.commands, null, 1),
    "```",
  ].join("\n");
}

function outputContractSection(scope: AssistScope): string {
  const common = [
    "2. 각 원소는 위 스키마의 Command 객체여야 한다.",
    "3. switchId/variableId/itemId/troopId/actorId/mapId/resourceId는 반드시 위 목록의 id를 사용한다.",
    "4. 위 kind 목록에 없는 명령은 만들지 않는다.",
    "5. transfer 의 x,y 는 대상 맵 크기 안이면서 밟을 수 있는 칸이어야 한다. 확실하지 않으면 위 목록의 «밟을 수 있는 칸 예» 를 쓴다.",
    "6. 요청이 모호하면 가장 단순하고 안전한 해석으로 생성한다.",
  ];
  if (scope === "append") {
    return [
      "## 출력 규약(반드시 준수)",
      "1. 출력은 **뒤에 붙일 새 커맨드 JSON 배열 하나**뿐이다. 설명·주석·여는 말 금지. ```json 펜스는 허용.",
      ...common,
      "7. 기존 커맨드를 다시 출력하지 마라 — 출력한 것이 그대로 뒤에 붙는다.",
    ].join("\n");
  }
  return [
    "## 출력 규약(반드시 준수)",
    "1. 출력은 **이 페이지의 고친 뒤 최종 커맨드 JSON 배열 하나**뿐이다. 설명·주석·여는 말 금지. ```json 펜스는 허용.",
    ...common,
    "7. 최종 목록이므로 **바꾸지 않을 기존 커맨드도 그대로 다시 포함**한다. 순서도 최종 순서다.",
    "8. 지울 커맨드는 출력에서 빼고, 고칠 커맨드는 고친 값으로 넣는다. 요청에 없는 커맨드를 임의로 지우지 마라.",
    "9. 요청이 '추가'라면 기존 목록에 새 커맨드를 끼운 전체 목록을 출력한다.",
  ].join("\n");
}

export function buildEventAssistPrompt(context: EventAssistContext): string {
  const { project, mapId, event, page, selection, selectionLabel } = context;
  const scope = resolveAssistScope(page);
  const mapName = project.maps[mapId]?.name ?? mapId;
  const kinds = aiCommandKinds(project);
  const sections: string[] = [];

  // 선택 위치는 사람 말로만 싣는다. 예전에는 경로 배열(`[2,-2,1]`)을 그대로 넣었는데,
  // -2 가 "fork 의 조건이 맞을 때 가지" 라는 범례가 프롬프트에 없어 모델에겐 잡음이었다.
  const selectionLine = selection && selection.length > 0
    ? (selectionLabel
      ? `사용자는 지금 목록에서 「${selectionLabel}」 커맨드를 고른 상태다 — 요청이 "이거"를 가리킬 수 있다.`
      : "사용자는 지금 목록에서 커맨드 하나를 고른 상태다 — 요청이 그 커맨드를 가리킬 수 있다.")
    : "사용자가 고른 커맨드는 없다.";

  sections.push(
    [
      "당신은 브라우저 기반 2D RPG 에디터의 이벤트 명령 편집기입니다.",
      scope === "page"
        ? "사용자의 자연어 요청대로 이 페이지의 커맨드 목록을 고쳐, 고친 뒤의 최종 목록을 JSON 배열로 돌려줍니다."
        : "사용자의 자연어 요청을 이 페이지 뒤에 붙일 커맨드 JSON 배열로 변환합니다.",
      "",
      `현재 위치: 맵 "${mapName}"(${mapId})` +
        (event ? `, 이벤트 ${event.id} (${event.x}, ${event.y})` : "") +
        (page ? `, 페이지 "${page.name || page.id}"` : ""),
      selectionLine,
    ].join("\n")
  );

  sections.push(
    [
      "## Command 스키마",
      `사용 가능한 kind: ${kinds.join(", ")}`,
      "",
      "kind별 기본값 JSON 예시(필드 구조 참고 — 값은 요청에 맞게 채울 것):",
      ...commandExampleLines(kinds),
      "",
      "중첩 규칙:",
      '- fork: {"kind":"fork","condition":<Condition>,"then":[<Command>...],"else":[<Command>...]} (else는 선택).',
      '- Condition 종류: {"kind":"switch","switchId","value"} / {"kind":"variable","variableId","op","value"} / {"kind":"selfSwitch","key":"A"~"D","value"} / {"kind":"item","itemId","present"} / {"kind":"actor","actorId","present"} / {"kind":"gold","op","amount"} / {"kind":"timer","timerId","seconds"}.',
      '- runControl action variants: start, advance, end, setFlag, resetRoom. 필드: start(seed?,runId?,startFloor?), advance(amount?), end(result), setFlag(flag,value), resetRoom(roomId?).',
      '- run condition queries: active, floor, flag, result. 필드: active(value?), floor(op,value), flag(flag,value), result(result).',
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
        Object.entries(project.maps).map(([id, map]) => ({
          id,
          name: mapReferenceLabel(project, id, map),
        }))
      ),
    ].join("\n")
  );

  // 이동 경로 대상 프로토콜. 이 절이 없어서 모델이 `eventId:"this"` 를 냈고, 그 값은 어떤
  // 이벤트도 가리키지 않아 테스트 플레이에서 조용히 아무 일도 일어나지 않았다(OPRN-OUT-012).
  if (kinds.includes("moveEvent")) {
    sections.push(moveTargetPromptSection(buildEventTargetCatalog(project, mapId)));
  }

  const canonSection = worldCanonPromptSection(project.worldCanon);
  if (canonSection) sections.push(canonSection);
  sections.push(existingCommandsSection(page, scope));
  sections.push(resourceSlotSection(project, kinds, context.requestText ?? ""));
  sections.push(outputContractSection(scope));

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

export function parseAndValidate(
  project: Project,
  text: string,
  options: {
    // "page" scope 에서 기존 명령이 있던 페이지는 빈 배열이 정당하다("전부 지워 줘").
    readonly allowEmpty?: boolean;
    /**
     * 이동 경로 대상을 대조할 맵. 런타임이 **이 맵**의 이벤트만 움직이므로 대상 검증에는
     * 맵이 필수다. 생략하면 시작 맵으로 본다(구 호출자 호환).
     */
    readonly mapId?: string;
    /** Existing commands are supplied for append scope so duplicate output is rejected. */
    readonly scope?: AssistScope;
    readonly existingCommands?: readonly Command[];
  } = {},
): AssistParseResult {
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
  if (parsed.length === 0 && !options.allowEmpty) {
    return { ok: false, errors: ["빈 배열입니다. 요청에 맞는 커맨드를 1개 이상 생성하세요."] };
  }

  // 1) 구조(shape) 검증 — 알 수 없는 kind/필드 타입 오류를 잡는다.
  try {
    validateCommandArray("commands", parsed);
  } catch (cause) {
    return { ok: false, errors: [cause instanceof Error ? cause.message : String(cause)] };
  }
  const commands = parsed as Command[];

  if (options.scope === "append" && options.existingCommands) {
    const existing = new Set(options.existingCommands.map(commandOwnFieldSignature));
    const duplicate = commands.find((command) => existing.has(commandOwnFieldSignature(command)));
    if (duplicate) {
      return { ok: false, errors: [`append 결과에 기존 명령과 같은 커맨드(${duplicate.kind})가 포함되어 있습니다. 새 커맨드만 출력하세요.`] };
    }
  }

  // 2) AI 저작 표면 검증 — 프롬프트에서 숨긴 명령을 모델이 임의로 반환해도 받아들이지 않는다.
  try {
    validateAiAuthoringSurfaces(commands);
  } catch (cause) {
    return { ok: false, errors: [cause instanceof Error ? cause.message : String(cause)] };
  }

  // 3) 세계관 금지어 검증 — text.body/speaker · choices.prompt/options · inputNumber.prompt ·
  //    inn.note/question · killPlayer.message · ending.title/message (중첩 분기 포함)에
  //    「이 세계」에 없는 말이 있으면 자가수정 루프가 고친다.
  const canonHits = collectCanonAbsenceHits(commands, project.worldCanon);
  if (canonHits.length > 0) {
    return { ok: false, errors: [`「이 세계」에 없는 것을 썼습니다 — 대사·선택지·숫자 입력·여관·게임오버·엔딩 문구에서 빼세요: ${canonHits.join(", ")}`] };
  }

  // 4) 참조 검증 — 존재하지 않는 itemId/switchId 등을 잡는다.
  const referenceContext = buildReferenceContext(project);
  try {
    validateCommands(commands, referenceContext);
    // io 검증이 다루지 않는 참조 보강(changeItem.itemId / changeParty.actorId).
    validateSupplementalReferences(commands, referenceContext);
    validateTransferBounds(commands, project);
    // resourceId 는 집합 소속만으로 부족하다 — 종류까지 맞지 않으면 조용히 깨진 이벤트가 된다.
    validateResourceSlots(commands, project);
    // 이동 경로 대상: 적용 **전에** 정본화하고, 못 옮기는 값은 자가수정 루프로 되돌린다.
    normalizeMoveEventTargets(
      commands,
      buildEventTargetCatalog(project, options.mapId ?? project.startMapId),
    );
  } catch (cause) {
    return { ok: false, errors: [cause instanceof Error ? cause.message : String(cause)] };
  }
  return { ok: true, commands };
}

/** 플레이어에게 보이는 문구(text 화자·본문·선택지 질문/문구·숫자 입력 안내·여관 인사/질문·
 *  게임오버 메시지·엔딩 제목/본문, 중첩 분기 포함)에 든 캐논 금지어를 모은다. 캐논이 비었으면 항상 빈 배열. */
function collectCanonAbsenceHits(commands: readonly Command[], canon: Project["worldCanon"]): readonly string[] {
  const hits = new Set<string>();
  const check = (text: string | undefined): void => {
    if (typeof text !== "string" || text.length === 0) return;
    for (const hit of findWorldCanonAbsenceHits(text, canon)) hits.add(hit);
  };
  const visit = (list: readonly Command[]): void => {
    for (const command of list) {
      if (command.kind === "text") {
        check(command.speaker);
        check(command.body);
      } else if (command.kind === "choices") {
        check(command.prompt);
        for (const option of command.options) check(option.text);
      } else if (command.kind === "inputNumber") check(command.prompt);
      else if (command.kind === "inn") {
        check(command.note);
        check(command.question);
      } else if (command.kind === "killPlayer") check(command.message);
      else if (command.kind === "ending") {
        check(command.title);
        check(command.message);
      }
      for (const branch of commandBranches(command)) visit(branch.commands);
    }
  };
  visit(commands);
  return [...hits];
}

// transfer 의 좌표는 맵 밖으로 나갈 수 있다. 프롬프트에 맵 크기를 실어도 모델은 (0,0) 같은
// "안전해 보이는" 값을 자주 쓰는데, 대부분 맵 테두리(벽)라 플레이어가 벽 안에 갇힌다.
// 여기서 잡아 주면 자가수정 루프가 스스로 고친다.
//
// 착지 칸 탐색은 **맵당 한 번**만 한다. 전에는 transfer 명령마다·시도마다 다시 계산해서
// 전면 통행 불가 맵이 섞이면 전수 탐색을 반복했다(실측: 128×128 맵 100개 1.46s).
function validateTransferBounds(commands: readonly Command[], project: Project): void {
  validateTransferBoundsWith(commands, project, new Map<string, { x: number; y: number } | null>());
}

function validateTransferBoundsWith(
  commands: readonly Command[],
  project: Project,
  landingCache: Map<string, { x: number; y: number } | null>,
): void {
  for (const command of commands) {
    if (command.kind === "transfer") {
      const map = project.maps[command.mapId];
      if (map) {
        if (command.x < 0 || command.y < 0 || command.x >= map.width || command.y >= map.height) {
          throw new Error(
            `transfer: 좌표가 맵 «${map.name || command.mapId}» 밖입니다(x=${command.x}, y=${command.y}; 가로 ${map.width} × 세로 ${map.height}).`,
          );
        }
        if (!isPassableLanding(project, map, command.x, command.y)) {
          if (!landingCache.has(command.mapId)) {
            landingCache.set(command.mapId, suggestedLandingCell(project, map));
          }
          // 밟을 수 있는 칸을 하나도 못 찾는 맵(타일셋 미해석 등)은 판정 근거가 없으니 반려하지 않는다.
          const landing = landingCache.get(command.mapId) ?? null;
          if (landing) {
            throw new Error(
              `transfer: 좌표(x=${command.x}, y=${command.y})가 맵 «${map.name || command.mapId}» 에서 밟을 수 없는 칸입니다. 밟을 수 있는 칸을 쓰세요. 예: x=${landing.x} y=${landing.y}`,
            );
          }
        }
      }
    }
    for (const branch of commandBranches(command)) {
      validateTransferBoundsWith(branch.commands, project, landingCache);
    }
  }
}

/**
 * resourceId 를 **종류까지** 대조한다.
 *
 * io/commandReferenceValidation 은 전역 리소스 집합 소속만 보므로
 * `{"kind":"playAudio","resourceId":"tex_easyrpg_chipset_dungeon"}` 가 그대로 통과해
 * **소리 없는 이벤트**가 조용히 저장된다. 자가수정 루프가 고칠 수 있는 오류로 바꿔 둔다.
 */
function validateResourceSlots(commands: readonly Command[], project: Project): void {
  const cache = new Map<EventResourceSlot, Set<string>>();
  const idsOf = (slot: EventResourceSlot): Set<string> => {
    const cached = cache.get(slot);
    if (cached) return cached;
    const fresh = eventResourceIdSet(slot, project);
    cache.set(slot, fresh);
    return fresh;
  };
  walkResourceSlots(commands, project, idsOf);
}

function walkResourceSlots(
  commands: readonly Command[],
  project: Project,
  idsOf: (slot: EventResourceSlot) => Set<string>,
): void {
  for (const command of commands) {
    if (isResourceBoundKind(command.kind)) {
      // kind 별 튜플로 좁혀지면 `includes("picture")` 가 never 비교가 되므로 슬롯 목록으로 넓힌다.
      const slots: readonly EventResourceSlot[] = RESOURCE_SLOTS_BY_KIND[command.kind];
      const resourceId = (command as { readonly resourceId?: string }).resourceId ?? "";
      // 빈 칸은 저작상 유효하다 — changeFace 는 «얼굴 지우기» 를 빈 문자열로 표현한다.
      if (resourceId.trim().length > 0) {
        // 그림 칸은 런타임(resolvePictureSource)이 해석하면 유효하다 — 폼도 자유 입력이고
        // 「그림 선택」 픽커는 `kind: "image"` 로 454개를 제시한다. 큐레이션 목록을 검증
        // 기준으로 쓰면 픽커가 권한 이미지 164개(scarloxy-monster-icon-*, monster 로 올린
        // 업로드 등)를 반려해, 저작 UI 로 만든 정당한 명령을 «잘못됐다»고 하게 된다(실측).
        // 해석기는 오디오 업로드를 거부하므로 종류 교차 보호는 그대로 살아 있다.
        // 알려진 한계: playMovie 는 미등록 id 폴백(playSceneMovies.ts:30-39)이 있어 이론상
        // 같은 false-reject 가 가능하지만, 동영상 슬롯이 비면 kind 자체를 빼므로 오늘은 도달 불가다.
        const allowed = slots.includes("picture")
          ? resolvePictureSource(resourceId, project) !== null
          : slots.some((slot) => idsOf(slot).has(resourceId));
        if (!allowed) {
          const labels = slots.map((slot) => EVENT_RESOURCE_SLOT_LABELS[slot]).join(" 또는 ");
          const example = slots
            .flatMap((slot) => listEventResourceOptions(slot, project).slice(0, 1))
            .map((option) => option.id)[0];
          throw new Error(
            `${command.kind}: resourceId «${resourceId}» 는 ${labels} 리소스가 아닙니다.`
            + (example
              ? ` ${labels} 목록의 id 를 쓰세요. 예: ${example}`
              : ` 이 프로젝트에는 ${labels} 리소스가 없으니 이 명령을 쓰지 마세요.`),
          );
        }
      }
    }
    for (const branch of commandBranches(command)) walkResourceSlots(branch.commands, project, idsOf);
  }
}

/**
 * moveEvent 의 대상을 **적용 전에** 정본값으로 옮긴다(중첩 분기 포함).
 *
 * 왜 반려만 하지 않고 옮기는가: 실측 오작동은 `"this"` 하나였고 그 뜻은 모호하지 않다.
 * 반려하면 자가수정 3회 예산을 태우고도 같은 값을 다시 낼 수 있다. 뜻이 유일하게
 * 정해지는 값(별칭 · 이 맵에서 유일한 표시 이름)만 옮기고, 그 밖은 실행 가능한 문구로
 * 반려해 자가수정 루프(runEventCommandAssist)가 고치게 한다.
 *
 * 여기서 손대는 것은 방금 파싱한 **응답 객체**뿐이다 — 저장된 프로젝트는 건드리지 않는다
 * (옛 프로젝트의 알 수 없는 id 는 편집기가 경고 + 복구 경로로 보존한다).
 *
 * 알려진 대가: "page" scope 는 기존 목록을 **그대로 다시** 출력하게 하므로, 페이지에 이미
 * 깨진 대상(예: 지워진 이벤트 id)이 있으면 모델이 그것을 되풀이해 반려된다. 그 반려 문구는
 * 이 맵의 유효한 id 를 담고 있고 모델은 그 값을 고칠 권한이 있어 자가수정으로 수렴한다.
 * 「기존에 있던 값이니 통과」로 완화하면, 조수가 새로 쓴 깨진 대상과 물려받은 깨진 대상을
 * 구별할 근거(원본 페이지)를 이 함수에 들여와야 하고 그만큼 조용히 통과하는 길이 생긴다.
 */
function normalizeMoveEventTargets(commands: readonly Command[], catalog: EventTargetCatalog): void {
  for (const command of commands) {
    if (command.kind === "moveEvent") {
      const resolved = resolveMoveTarget(command.eventId, catalog);
      if (resolved.kind === "unresolved") {
        throw new Error(`moveEvent: ${moveTargetIssueMessage(command.eventId, catalog)}`);
      }
      (command as { eventId: string }).eventId = resolved.storedValue;
    }
    for (const branch of commandBranches(command)) normalizeMoveEventTargets(branch.commands, catalog);
  }
}

function validateAiAuthoringSurfaces(commands: readonly Command[]): void {
  for (const command of commands) {
    if (!COMMAND_GUARANTEES[command.kind].authoringSurfaces.includes("ai")) {
      throw new Error(`${command.kind}: AI 저작 표면에서 사용할 수 없는 명령입니다.`);
    }
    for (const branch of commandBranches(command)) validateAiAuthoringSurfaces(branch.commands);
  }
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
      case "inn":
        validateSupplementalReferences(command.notEnoughBranch ?? [], context);
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
  /** 프로젝트 한정 성향 조회 키(conversationScopeKey). 없으면 전역 성향만 붙는다. */
  readonly projectScopeKey?: string;
}): Promise<AssistRunResult> {
  const { prompt, context, onDelta, signal } = options;
  const config = resolveSurfaceAiConfig("event-command", options.config);
  const scope = resolveAssistScope(context.page);
  const allowEmpty = scope === "page" && (context.page?.commands.length ?? 0) > 0;
  const messages: ChatMessage[] = [
    {
      role: "system",
      // 공용 봉투 경유 — 이 채널이 사람 성향을 받는 유일한 지점이다.
      // includePolicy 는 끈다: 산출물이 JSON 커맨드 배열이라 AGENT_UX_POLICY_LINES 의 마무리 톤 규칙
      // ("최종 응답은 3~5문장")이 "JSON 배열만 출력"과 정면으로 충돌하고, 정책이 언급하는 툴
      // (author_house·configure_time_system 등)은 이 채널에 아예 없다.
      content: composeSystemPrompt({
        surface: "event-command",
        body: buildEventAssistPrompt({ ...context, requestText: prompt }),
        includeMemory: true,
        ...(options.projectScopeKey ? { projectScopeKey: options.projectScopeKey } : {}),
      }),
    },
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
    // mapId 는 이동 경로 대상 대조에 쓰인다 — 편집 중인 맵이 아니면 판정이 틀린다.
    const parsed = parseAndValidate(context.project, content, {
      allowEmpty,
      mapId: context.mapId,
      scope,
      existingCommands: context.page?.commands,
    });
    if (parsed.ok) return { commands: parsed.commands, scope, attempts: attempt };

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

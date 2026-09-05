// @vitest-environment happy-dom
// test/eventEditorShellSurface.baseline.test.ts
//
// 이벤트에디터 셸(3칼럼 + 페이지 탭 + 조건 그리드 + 명령 리스트) 표면 스냅샷.
// 커맨드 폼 축(FormSurface/M2Surface)이 못 보는 것을 여기서 본다:
//   - 셸 클래스 (event-editor.balanced.css 140종 중 127종이 셸 전용 — CSS 정리의 실제 감시 대상.
//     `scripts/check-css-live-classes.mjs` 가 이 파일의 기준선 `page*.classes` 를 실사용 정본으로 읽는다.)
//   - details/div 태그 구성 (content.ts 의 details→div 후처리. 태그별 히스토그램 + tagByTestid 로 고정)
//   - 다중 페이지 선택 (pages[1] 을 선택한 상태 — 기존 게이트는 전부 pages[0] 픽스처라 사각)
//   - 셸 컨트롤의 위치·상태(controls) / select 선택지(selectOptions) / 라벨(labels)
//
// 갱신: SHELL_SURFACE_UPDATE=1 npx vitest run test/eventEditorShellSurface.baseline.test.ts
//   (갱신 실행은 설계상 실패한다 — surfaceGateSupport 의 래칫. 갱신 후 환경변수 없이 다시 돌려라.)
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { editorState } from "@/editor/editorState";
import { renderEventEditorContent } from "@/editor/panels/eventEditor/content";
import { store } from "@/project/store";
import type { Command, EventPage, EventPageCondition, GameEvent } from "@/project/types";
import { createCaptureProject } from "./fixtures/captureProject";
import { assertSurfaceGate, type FloorMetrics } from "./surfaceGateSupport";

const BASELINE = resolve(process.cwd(), "test/fixtures/eventEditorShellSurface.baseline.json");
const FLOOR = resolve(process.cwd(), "test/fixtures/eventEditorShellSurface.floor.json");

// ─────────────────────────────────────────────────────────────────────────────
// 픽스처
// ─────────────────────────────────────────────────────────────────────────────

/** NPC 관계 연결 키. 이게 있어야 renderEventCharacterSocialExtras 가 details 를 낸다(후처리 입력). */
const CHARACTER_ID = "npc_shell_probe";

function page(
  id: string,
  name: string,
  conditions: EventPageCondition[],
  commands: Command[],
): EventPage {
  return {
    id,
    name,
    conditions,
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

/**
 * 1페이지 조건 3종 — 전부 «고정 조건 행»(pageConditions.ts 의 13행)에 매핑되는 서로 다른 kind.
 * 조건이 비면 13행 전부 `disabled` 클래스 + conditionActive=false 로만 렌더돼 활성 분기가 죽는다.
 */
const PAGE1_CONDITIONS: EventPageCondition[] = [
  { kind: "switch", switchId: "sw_shell_a", value: true },
  { kind: "variable", variableId: "var_shell_a", op: ">=", value: 3 },
  { kind: "item", itemId: "item_shell_a", present: true },
];

/**
 * 2페이지 조건 3종 — 1페이지와 겹치지 않는 kind 를 골랐고, 마지막은 묶음(any) 조건이다.
 * 묶음과 gold 는 고정 행에 자리가 없어 `renderAdvancedConditions` 의 고급 목록으로 떨어진다
 * (pageConditionModel.advancedConditionEntries). 즉 고급 목록 + 중첩 자식 렌더까지 탄다.
 */
const PAGE2_CONDITIONS: EventPageCondition[] = [
  { kind: "selfSwitch", key: "B", value: true },
  { kind: "timePhase", phase: "night" },
  {
    kind: "any",
    conditions: [
      { kind: "gold", op: ">=", amount: 250 },
      { kind: "season", season: "winter" },
    ],
  },
];

/**
 * 고정 조건 13행을 **전부** 켜는 묶음.
 *
 * 왜 필요한가(실측): main 의 칩 재설계(fbc32034) 이후 조건 행은 «켠 것만» 렌더된다. 그래서
 * page1+page2 가 켜지 않는 kind 는 표면에서 통째로 사라졌고, CSS 실사용 정본이 5종을 잃었다 —
 * `.timer` `.friendship` `.npc-activity` `.event-condition-time-unit`
 * `.event-condition-friendship-hint`. **제품에서 죽은 게 아니라 픽스처가 도달하지 못한 것**이라
 * 기준선을 갱신하면 안 되고 픽스처가 13행을 다 켜야 한다. 예전의 «13행 상시 펼침» 은 이
 * 커버리지를 공짜로 줬고, 칩 UI 에서는 명시적으로 켜야 한다.
 *
 * `captureShell` 이 이 변형에 `characterId` 를 **일부러 붙이지 않는다** —
 * friendshipAlwaysFalseHint(conditionForm.ts:1079-1090)는 `hostHasCharacterId === false` 이고
 * npcKey 가 빈칸일 때만 나오는 경고라, 연결된 픽스처로는 절대 렌더되지 않는다.
 *
 * switch/timer 는 kind 하나가 두 행(switch1·switch2, timer1·timer2)으로 갈리므로 두 개씩 넣는다.
 */
const ALL_ROW_CONDITIONS: EventPageCondition[] = [
  { kind: "switch", switchId: "sw_0001", value: true },
  { kind: "switch", switchId: "sw_0002", value: false },
  { kind: "variable", variableId: "var_shell_a", op: ">=", value: 3 },
  { kind: "item", itemId: "item_shell_a", present: true },
  { kind: "actor", actorId: "actor_hero", present: true },
  // seconds 는 분/초 두 입력으로 갈라 렌더된다 — 60 을 넘겨 둘 다 채운다(event-condition-time-unit).
  { kind: "timer", timerId: "timer1", seconds: 90 },
  { kind: "timer", timerId: "timer2", seconds: 30 },
  { kind: "timePhase", phase: "night" },
  { kind: "season", season: "winter" },
  { kind: "npcActivity", activity: "work" },
  // npcKey 빈칸 = 항상 거짓 경고 분기(위 주석 참고).
  { kind: "friendshipAtLeast", npcKey: "", value: 200 },
  { kind: "relationshipAtLeast", npcKey: "", state: "dating" },
  { kind: "selfSwitch", key: "B", value: true },
];

/** 1페이지 명령 — 2페이지가 갖지 않는 kind 만 쓴다(D-3 의 페이지 diff 단정에 쓰인다). */
const PAGE1_COMMANDS: Command[] = [
  { kind: "text", body: "1페이지 대사" },
  { kind: "setSwitch", switchId: "sw_shell_a", value: true },
  { kind: "wait", ms: 200 },
  { kind: "changeItem", itemId: "item_shell_a", op: "+=", amount: 1 },
];

/**
 * 2페이지 명령 — fork/loop/choices 의 자식 명령을 채워 **중첩 리스트 렌더**(들여쓰기·분기 드롭존)를
 * 태운다. 예전 픽스처는 `then: [], else: []` 라 분기 렌더가 빈 자리 한 줄로 끝났다.
 */
const PAGE2_COMMANDS: Command[] = [
  { kind: "changeGold", op: "+=", amount: 50 },
  {
    kind: "fork",
    condition: { kind: "switch", switchId: "sw_shell_a", value: true },
    then: [
      { kind: "transfer", mapId: "map_shell_missing", x: 2, y: 3 },
      { kind: "playAudio", resourceId: "res_shell_missing", loop: false },
    ],
    else: [{ kind: "setVariable", variableId: "var_shell_a", op: "=", value: 1 }],
  },
  { kind: "loop", body: [{ kind: "breakLoop" }] },
  {
    kind: "choices",
    options: [
      { text: "예", branch: [{ kind: "changeGold", op: "-=", amount: 10 }] },
      { text: "아니오", branch: [] },
    ],
  },
];

/** 1페이지에만 있어야 하는 명령 testid (commandList.ts: `event-command-${cmd.kind}`). */
const PAGE1_ONLY_COMMAND_TESTIDS = [
  "event-command-text",
  "event-command-setSwitch",
  "event-command-wait",
  "event-command-changeItem",
];

/** 2페이지에만 있어야 하는 명령 testid — 중첩 자식(transfer/playAudio/setVariable/breakLoop) 포함. */
const PAGE2_ONLY_COMMAND_TESTIDS = [
  "event-command-changeGold",
  "event-command-fork",
  "event-command-transfer",
  "event-command-playAudio",
  "event-command-setVariable",
  "event-command-loop",
  "event-command-breakLoop",
  "event-command-choices",
];

// ─────────────────────────────────────────────────────────────────────────────
// details → div 후처리 계약
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `src` 에서 **`el("details", …)` 로 저작**되지만 화면에는 `div` 로 나와야 하는 노드의 클래스.
 *
 * 왜 클래스로 사후 검사하는가 — 후처리는 렌더 함수 내부(content.ts:228)에서 일어나므로
 * 테스트가 «변환 전» DOM 을 손에 넣을 수 없다. 대신 «이 클래스를 가진 노드는 div 여야 하고
 * details 로 남은 게 하나도 없어야 한다»는 사후 불변식으로 증명한다. 후처리가 통째로
 * 사라지면 이 노드들이 details 로 남으므로 detailsConverted 가 떨어지고
 * detailsUnconverted 가 0을 벗어난다 — 둘 다 실패한다.
 *
 * 출처(읽기만 함, 수정 금지):
 *   - `event-collapsible-section`          pageProps.ts collapsibleSection() → el("details")
 *                                          (조건 / 움직임 섹션. pageProps.ts:927 의 레일 후처리가 변환)
 *   - `event-character-social-extras`       pageProps.ts:514 → el("details")
 *   - `event-character-social-advanced`     pageProps.ts:559 → 위 details 안의 중첩 details
 *                                          (뒤 둘은 appendEventRailGroup 이후에 붙으므로
 *                                           **content.ts:228 후처리만이** 변환한다)
 */
const DETAILS_AUTHORED_CLASSES = [
  "event-collapsible-section",
  "event-character-social-extras",
  "event-character-social-advanced",
] as const;

/**
 * 후처리가 **건드리지 않는** details (content.ts:228 의 예외 목록). 살아 있어야 정상이다.
 *   - `.event-editor-settings-accordion-group` 클래스를 가진 노드 (실제로는 이미 div 다)
 *   - `[data-testid=event-schedule-editor]` / `event-schedule-section` 과 그 후손
 */
const DETAILS_EXEMPT_TESTIDS = ["event-schedule-editor", "event-schedule-section"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 표면 축
// ─────────────────────────────────────────────────────────────────────────────

type ShellCounts = {
  testidCount: number;
  controlCount: number;
  classCount: number;
  labelCount: number;
  /** DETAILS_AUTHORED_CLASSES 를 가진 노드 중 div 로 변환된 개수. 0 이면 후처리 경로가 죽었다. */
  detailsConverted: number;
  /** 같은 클래스인데 details 로 남은 개수. 0 이 아니면 후처리가 일부를 놓쳤다. */
  detailsUnconverted: number;
  selectCount: number;
};

type ShellSurface = {
  /** 최상위 계약 — check-css-live-classes.mjs 가 이 배열을 실사용 CSS 클래스 정본으로 읽는다. */
  classes: string[];
  testids: string[];
  tags: Record<string, number>;
  /** testid → tagName. details→div 같은 태그 교체를 정확히 지목한다. */
  tagByTestid: Record<string, string>;
  /** stableKey → `tag[type]{flags}`. 컨트롤이 위치까지 고정된다. */
  controls: Record<string, string>;
  /** stableKey → select 옵션 값. 100개 초과는 ["<n개>", 첫값, 끝값] 으로 압축. */
  selectOptions: Record<string, string[]>;
  /** 라벨/버튼/summary/legend 텍스트. 숫자는 `#` 로 마스킹(DB 잡음 제거). */
  labels: string[];
  counts: ShellCounts;
  error?: string;
};

/**
 * 100개 초과 select 는 값 목록 대신 `["<n개>", 첫값, 끝값]` 만 남긴다(카탈로그 증감 잡음 차단).
 *
 * 실측(createCaptureProject 절단 적용 후): 셸의 최대 select 는 22개
 * (`event-page-switch-condition-input`)이고 100 초과는 **0개**다 — 즉 지금 이 압축 경로는
 * 발동하지 않는다. 그래도 남겨 둔다: 절단(KEEP=3)이 풀리거나 새 select 가 DB 전체를 열거하면
 * 그 순간 옵션 수백 줄이 기준선에 쏟아져 진짜 컨트롤 소실을 덮는다.
 */
const SELECT_OPTION_LIMIT = 100;

function emptySurface(error: string): ShellSurface {
  return {
    classes: [],
    testids: [],
    tags: {},
    tagByTestid: {},
    controls: {},
    selectOptions: {},
    labels: [],
    counts: {
      testidCount: 0,
      controlCount: 0,
      classCount: 0,
      labelCount: 0,
      detailsConverted: 0,
      detailsUnconverted: 0,
      selectCount: 0,
    },
    error,
  };
}

/**
 * 래퍼 div 삽입에 불변인 노드 키.
 *
 * 규칙: 자기 testid → 없으면 `가장 가까운 조상 testid + ">" + tagName + "#" + 그 조상 서브트리
 * 안 같은 tagName 의 0-base 문서순 서수` → 조상 testid 가 없으면 `:root>tag#n`.
 *
 * 서수를 «부모의 자식 중»이 아니라 «조상 서브트리 전체 중»으로 세기 때문에 사이에 div 래퍼가
 * 끼어도 select/input/button/textarea 의 키가 흔들리지 않는다.
 * (A 의 test/eventEditorFormSurface.ts 를 import 하지 않고 이 파일에서 자체 구현한다 — 계약상 그 파일은 재작성 중이다.)
 */
function stableKey(root: HTMLElement, node: Element): string {
  const own = (node as HTMLElement).dataset?.testid;
  if (own) return own;
  const tag = node.tagName.toLowerCase();
  let host: HTMLElement | null = null;
  let parent = node.parentElement;
  while (parent) {
    if (parent === root) break;
    if (parent.dataset?.testid) {
      host = parent;
      break;
    }
    parent = parent.parentElement;
  }
  const scope: HTMLElement = host ?? root;
  const ordinal = Array.from(scope.querySelectorAll(tag)).indexOf(node);
  return host ? `${host.dataset.testid}>${tag}#${ordinal}` : `:root>${tag}#${ordinal}`;
}

/** 같은 키가 두 번 나오면(중복 testid) 조용히 덮지 않고 `~n` 을 붙인다. */
function uniqueKey(taken: Map<string, number>, key: string): string {
  const seen = taken.get(key) ?? 0;
  taken.set(key, seen + 1);
  return seen === 0 ? key : `${key}~${seen}`;
}

function controlSignature(node: Element): string {
  const tag = node.tagName.toLowerCase();
  const type = node.getAttribute("type");
  const flags: string[] = [];
  const html = node as HTMLElement & {
    disabled?: boolean;
    readOnly?: boolean;
    required?: boolean;
    checked?: boolean;
    multiple?: boolean;
  };
  if (html.hidden) flags.push("hidden");
  // 조상이 숨겨져 있으면 컨트롤 자체는 hidden 이 아니어도 사용자에게 안 보인다.
  // 뷰 모드(applyViewMode)가 cmd-list 를 숨기는 계약이 여기서 고정된다.
  if (node.closest("[hidden]") !== null && !html.hidden) flags.push("inHidden");
  if (html.disabled === true) flags.push("disabled");
  if (html.readOnly === true) flags.push("readonly");
  if (html.required === true) flags.push("required");
  if (html.checked === true) flags.push("checked");
  if (html.multiple === true) flags.push("multiple");
  return `${tag}${type ? `[${type}]` : ""}${flags.length ? `{${flags.sort().join(",")}}` : ""}`;
}

/** 숫자를 `#` 로 접는다 — DB 개수/가격/좌표가 라벨에 새어 들어와 게이트를 흔드는 것을 막는다. */
function maskLabel(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/\d+/g, "#").slice(0, 80);
}

function countDetailsConversion(root: HTMLElement): { converted: number; unconverted: number } {
  const settings = root.querySelector<HTMLElement>(".event-editor-settings-column");
  if (!settings) return { converted: 0, unconverted: 0 };
  const selector = DETAILS_AUTHORED_CLASSES.map((c) => `.${c}`).join(", ");
  let converted = 0;
  let unconverted = 0;
  for (const node of Array.from(settings.querySelectorAll(selector))) {
    if (node.tagName.toLowerCase() === "div") converted += 1;
    else if (node.tagName.toLowerCase() === "details") unconverted += 1;
  }
  return { converted, unconverted };
}

/**
 * 크래시를 진단 가능한 문자열로 접는다 — 스택 **앞 4프레임**까지, 전체 800자 상한.
 *
 * 예전엔 `${name}: ${message}` 200자만 담아 스택을 버렸다. 실측: 다른 세션이 content.ts 를
 * 깨뜨렸을 때 «tags {} / controlCount 104→0» 만 보였고 원인을 찾으려면 따로 tsc 를 돌려야 했다.
 * 4프레임이면 어느 렌더 함수에서 터졌는지 즉시 보인다.
 */
function formatCaptureError(e: unknown): string {
  const err = e as Error;
  const frames = (err?.stack ?? "").split("\n").slice(1, 5).join("\n");
  return `${err?.name ?? "Unknown"}: ${err?.message ?? String(e)}\n${frames}`.slice(0, 800);
}

/**
 * 셸 렌더 변형.
 *
 * `bare: true` 는 **새로 만든 이벤트의 기본 상태**다 — 캐릭터 미연결 + 선택 페이지의 조건 0개.
 * 이 상태를 따로 잡는 이유(실측): 기본 픽스처는 characterId 를 채우고 조건도 넣기 때문에
 * `.is-unlinked`(pageProps.ts:395,404) 와 `.event-condition-summary-empty`(pageProps.ts:977)
 * 분기를 **한 번도 타지 않는다**. CSS 실사용 정본 래칫이 이 두 클래스의 소실로 잡아냈다.
 * 사용자가 이벤트를 만들면 가장 먼저 보는 화면이라 엣지 케이스가 아니다.
 *
 * `allRows: true` 는 **고정 조건 13행을 전부 켠 상태**다(ALL_ROW_CONDITIONS 주석 참고).
 * 칩 재설계 이후 «켜지 않은 kind 는 아예 렌더되지 않는다» 는 성질 때문에, 이 변형이 없으면
 * timer·friendship·npcActivity 행의 표면이 어느 축에도 남지 않는다.
 */
/**
 * `flow: true` 는 **플로우 보기를 켠 상태**다.
 *
 * 왜 따로 잡는가 (실측): #364 이전에는 플로우 마크업이 기본 보기에서도 미리 렌더돼 숨어
 * 있었고, 그래서 `bare` 표본의 classCount 하한선이 그 마크업을 세고 있었다. #364 가 플로우를
 * `event-page-flow-host` 로 옮기면서 **지연 렌더**로 바꾸자(content.ts: isFlow 일 때만
 * renderEventPageFlow) 기본 표본에서 event-flow-* 클래스 10종이 사라졌다.
 *
 * 기능은 살아 있는데 표본이 못 보는 상태였다. 하한선을 낮춰서 넘기면 «플로우가 정말 지워지는
 * 회귀» 를 앞으로 못 잡는다 — 그래서 하한선을 낮추는 대신 **플로우를 켠 표본을 추가**해
 * 가드가 계속 그 마크업을 세게 한다.
 */
type ShellVariant = { readonly bare?: boolean; readonly flow?: boolean; readonly allRows?: boolean };

/** selectedPageIndex 를 지정해 렌더한다. index 1 = 2페이지 선택(다중 페이지 사각 차단). */
function captureShell(selectedPageIndex: number, variant: ShellVariant = {}): ShellSurface {
  const project = createCaptureProject();
  const mapId = Object.keys(project.maps)[0];
  const pages = variant.bare
    ? [page("shell_p1", "EV001", [], PAGE1_COMMANDS), page("shell_p2", "EV002", [], PAGE2_COMMANDS)]
    : variant.allRows
      ? [
          page("shell_p1", "EV001", ALL_ROW_CONDITIONS, PAGE1_COMMANDS),
          page("shell_p2", "EV002", PAGE2_CONDITIONS, PAGE2_COMMANDS),
        ]
      : [
          page("shell_p1", "EV001", PAGE1_CONDITIONS, PAGE1_COMMANDS),
          page("shell_p2", "EV002", PAGE2_CONDITIONS, PAGE2_COMMANDS),
        ];
  // trigger/commands 는 GameEvent 필수 필드다. 페이지 기반 이벤트라 레거시 최상위
  // commands 는 비워 두고, 편집 대상은 pages 쪽이다.
  const ev: GameEvent = {
    id: "ev_shell",
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    pages,
    // NPC 관계를 연결해야 renderEventCharacterSocialExtras 가 details 를 낸다 →
    // content.ts:228 후처리가 실제로 변환할 입력이 생긴다(예전 픽스처는 변환 0건이었다).
    // allRows 도 미연결로 둔다 — friendship 행의 «항상 거짓» 경고가 미연결에서만 나온다
    // (conditionForm.ts:1084). details 후처리 입력은 page1/page2 변형이 계속 덮는다.
    ...(variant.bare || variant.allRows ? {} : { characterId: CHARACTER_ID, talkFriendship: true }),
  };
  // 맵에 이벤트 2개 — 목록/선택 UI 가 «단일 항목» 특수 경로를 타지 않게 한다.
  const other: GameEvent = {
    id: "ev_shell_other",
    x: 4,
    y: 2,
    trigger: { kind: "touch" },
    commands: [],
    pages: [page("shell_other_p1", "EV001", [], [{ kind: "text", body: "다른 이벤트" }])],
  };
  (project.maps[mapId] as { events: GameEvent[] }).events.push(ev, other);
  project.characters = { [CHARACTER_ID]: { displayName: "셸 프로브" } };
  store.replace(project);
  // 렌더가 읽는 editorState 필드를 매번 명시적으로 못 박는다 — 다른 테스트가 남긴 값이
  // 새어 들어오면 표면이 실행 순서에 따라 달라진다(비결정 함정).
  editorState.set({
    currentMapId: mapId,
    selectedEventId: ev.id,
    selectedEventPageId: pages[selectedPageIndex].id,
  });
  // 뷰 모드(storyboard/list)와 설정 칼럼 폭은 localStorage 에 남는다 — 매번 기본값에서 시작한다.
  try {
    localStorage.clear();
  } catch {
    /* happy-dom 이 localStorage 를 막아도 기본값으로 진행한다 */
  }

  const container = document.createElement("div");
  try {
    renderEventEditorContent(container, mapId, ev.id);
    if (variant.flow) {
      // 플로우는 지연 렌더다. 세그먼트를 실제로 눌러서 host 가 채워진 뒤에 잰다 —
      // 버튼이 사라지면 여기서 던져서 «입구가 없어진 회귀» 도 같이 잡힌다.
      const toggle = container.querySelector<HTMLElement>('[data-testid="event-view-toggle-flow"]');
      if (!toggle) throw new Error("플로우 보기 세그먼트(event-view-toggle-flow)가 없다");
      toggle.click();
    }
  } catch (e) {
    return emptySurface(formatCaptureError(e));
  }

  const testids = new Set<string>();
  const tagByTestid: Record<string, Set<string>> = {};
  const classes = new Set<string>();
  const tags: Record<string, number> = {};
  for (const node of Array.from(container.querySelectorAll("*"))) {
    const html = node as HTMLElement;
    const id = html.dataset?.testid;
    const tag = node.tagName.toLowerCase();
    if (id) {
      testids.add(id);
      (tagByTestid[id] ??= new Set()).add(tag);
    }
    for (const cls of Array.from(html.classList ?? [])) classes.add(cls);
    tags[tag] = (tags[tag] ?? 0) + 1;
  }

  const controls: Record<string, string> = {};
  const selectOptions: Record<string, string[]> = {};
  const controlNodes = Array.from(container.querySelectorAll("input, select, textarea, button"));
  const takenControlKeys = new Map<string, number>();
  for (const node of controlNodes) {
    const key = uniqueKey(takenControlKeys, stableKey(container, node));
    controls[key] = controlSignature(node);
    if (node.tagName.toLowerCase() !== "select") continue;
    const values = Array.from(node.querySelectorAll("option")).map((o) => o.getAttribute("value") ?? "");
    selectOptions[key] =
      values.length > SELECT_OPTION_LIMIT
        ? [`<${values.length}개>`, values[0] ?? "", values[values.length - 1] ?? ""]
        : values;
  }

  const labels = new Set<string>();
  for (const node of Array.from(container.querySelectorAll("label, button, summary, legend, h4"))) {
    const text = maskLabel(node.textContent ?? "");
    if (text) labels.add(text);
  }

  const conversion = countDetailsConversion(container);
  const sortedTestids = Array.from(testids).sort();
  const sortedClasses = Array.from(classes).sort();
  const sortedLabels = Array.from(labels).sort();
  return {
    classes: sortedClasses,
    testids: sortedTestids,
    tags: sortRecord(tags),
    tagByTestid: sortRecord(
      Object.fromEntries(Object.entries(tagByTestid).map(([k, v]) => [k, Array.from(v).sort().join("|")])),
    ),
    controls: sortRecord(controls),
    selectOptions: sortRecord(selectOptions),
    labels: sortedLabels,
    counts: {
      testidCount: sortedTestids.length,
      controlCount: controlNodes.length,
      classCount: sortedClasses.length,
      labelCount: sortedLabels.length,
      detailsConverted: conversion.converted,
      detailsUnconverted: conversion.unconverted,
      selectCount: Object.keys(selectOptions).length,
    },
  };
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

// ─────────────────────────────────────────────────────────────────────────────
// diff — 순수 함수로 분리한다(합성 변이 증명이 이걸 직접 호출한다)
// ─────────────────────────────────────────────────────────────────────────────

function listDiff(label: string, before: readonly string[], after: readonly string[]): string[] {
  const lost = before.filter((v) => !after.includes(v));
  const added = after.filter((v) => !before.includes(v));
  const parts: string[] = [];
  if (lost.length) parts.push(`${label} 소실 ${lost.length}개 [${lost.slice(0, 10).join(", ")}]`);
  if (added.length) parts.push(`${label} 신규 ${added.length}개 [${added.slice(0, 10).join(", ")}]`);
  return parts;
}

/** 태그별로만 보고한다 — 통째 JSON 비교는 details 7→6 하나에 히스토그램 전체를 토했다. */
function tagDiff(before: Record<string, number>, after: Record<string, number>): string[] {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  const parts: string[] = [];
  for (const tag of keys) {
    const b = before[tag] ?? 0;
    const a = after[tag] ?? 0;
    if (b === a) continue;
    parts.push(a === 0 ? `태그 ${tag} ${b}→0 (소실)` : `태그 ${tag} ${b}→${a}`);
  }
  return parts;
}

function mapDiff(label: string, before: Record<string, string>, after: Record<string, string>): string[] {
  const parts = listDiff(`${label} 키`, Object.keys(before), Object.keys(after));
  const changed = Object.keys(before)
    .filter((k) => k in after && before[k] !== after[k])
    .map((k) => `${k} ${before[k]}→${after[k]}`);
  if (changed.length) parts.push(`${label} 변경 ${changed.length}건 [${changed.slice(0, 8).join(", ")}]`);
  return parts;
}

function selectOptionsDiff(
  before: Record<string, string[]>,
  after: Record<string, string[]>,
): string[] {
  const parts = listDiff("select", Object.keys(before), Object.keys(after));
  const changed: string[] = [];
  for (const key of Object.keys(before)) {
    if (!(key in after)) continue;
    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    const lost = b.filter((v) => !a.includes(v));
    const added = a.filter((v) => !b.includes(v));
    changed.push(
      `${key} ${b.length}→${a.length}개` +
        (lost.length ? ` 소실[${lost.slice(0, 5).join(",")}]` : "") +
        (added.length ? ` 신규[${added.slice(0, 5).join(",")}]` : ""),
    );
  }
  if (changed.length) parts.push(`select 옵션 변경 ${changed.length}건 [${changed.slice(0, 6).join(" · ")}]`);
  return parts;
}

function countsDiff(before: ShellCounts, after: ShellCounts): string[] {
  const parts: string[] = [];
  for (const key of Object.keys(before) as (keyof ShellCounts)[]) {
    if (before[key] !== after[key]) parts.push(`${key} ${before[key]}→${after[key]}`);
  }
  return parts;
}

/**
 * 축 모양이 늘어난 직후엔 기준선에 새 필드가 없다(예: tagByTestid 추가 전 기준선).
 * 그때 diff 가 예외로 죽으면 «표면이 달라졌다» 대신 TypeError 가 떠 원인이 묻힌다 —
 * 없는 필드는 빈 값으로 읽고, 필드 자체가 비었다는 사실을 보고 줄로 남긴다.
 */
function normalize(surface: ShellSurface): ShellSurface {
  return {
    ...surface,
    classes: surface.classes ?? [],
    testids: surface.testids ?? [],
    tags: surface.tags ?? {},
    tagByTestid: surface.tagByTestid ?? {},
    controls: surface.controls ?? {},
    selectOptions: surface.selectOptions ?? {},
    labels: surface.labels ?? [],
    counts: surface.counts ?? {
      testidCount: 0,
      controlCount: 0,
      classCount: 0,
      labelCount: 0,
      detailsConverted: 0,
      detailsUnconverted: 0,
      selectCount: 0,
    },
  };
}

function shellDiff(rawBefore: ShellSurface, rawAfter: ShellSurface): string[] {
  const before = normalize(rawBefore);
  const after = normalize(rawAfter);
  if (before.error !== after.error) {
    return [after.error ? `크래시 발생: ${after.error.split("\n")[0]}` : "이전 기준선이 크래시 상태였다(해소됨)"];
  }
  const missing = (["tagByTestid", "controls", "selectOptions", "labels", "counts"] as const).filter(
    (key) => rawBefore[key] === undefined,
  );
  return [
    ...(missing.length ? [`기준선에 축 필드가 없다(모양 확장 직후): ${missing.join(", ")}`] : []),
    ...listDiff("testid", before.testids, after.testids),
    ...listDiff("클래스", before.classes, after.classes),
    ...tagDiff(before.tags, after.tags),
    ...mapDiff("tagByTestid", before.tagByTestid, after.tagByTestid),
    ...mapDiff("컨트롤", before.controls, after.controls),
    ...selectOptionsDiff(before.selectOptions, after.selectOptions),
    ...listDiff("라벨", before.labels, after.labels),
    ...countsDiff(before.counts, after.counts),
  ];
}

function shellMetrics(surface: ShellSurface): FloorMetrics {
  return {
    testidCount: surface.counts.testidCount,
    controlCount: surface.counts.controlCount,
    classCount: surface.counts.classCount,
    labelCount: surface.counts.labelCount,
    // 후처리 소실을 «기준선 갱신»으로도 덮을 수 없게 하한선에 넣는다 — D-1 의 핵심.
    detailsConverted: surface.counts.detailsConverted,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────────────────────────────────────

/** 수확은 파일당 한 번만 한다 — 렌더가 모듈 전역(open-state 셋)을 만지므로 재수확은 순서 의존을 만든다. */
const actual = {
  page1: captureShell(0),
  page2: captureShell(1),
  bare: captureShell(0, { bare: true }),
  // #364 가 플로우를 지연 렌더로 바꾼 뒤 기본 표본이 event-flow-* 를 못 본다. 플로우를 켠
  // 표본을 따로 잡아 가드가 그 마크업을 계속 세게 한다.
  flow: captureShell(0, { flow: true }),
  allRows: captureShell(0, { allRows: true }),
};
const crashed = Object.entries(actual).filter(([, surface]) => surface.error);

describe("이벤트에디터 셸 표면 스냅샷", () => {

  it("두 페이지 모두 예외 없이 렌더된다", () => {
    // 스택 4프레임이 여기 그대로 찍힌다 — 예전엔 name+message 만 남아 원인 추적에 tsc 를 따로 돌렸다.
    expect(
      Object.entries(actual)
        .filter(([, s]) => s.error)
        .map(([k, s]) => `${k}\n${s.error}`),
    ).toEqual([]);
  });

  it("2페이지 선택이 1페이지와 다른 결과를 낸다 (페이지 선택 배선이 살아 있다)", () => {
    // 두 페이지가 «둘 다 크래시»하면 표면이 똑같아진다 — 예전 JSON 전체 비교는 그걸
    // "페이지 선택 배선이 죽었다"로 잘못 보고했다. 에러가 있으면 이 단정은 건너뛴다.
    if (crashed.length) return;
    // 무엇이 달라야 하는지 명시한다 — "달라졌지만 엉뚱하게 달라진" 경우도 잡는다.
    for (const id of PAGE1_ONLY_COMMAND_TESTIDS) {
      expect(actual.page1.testids, `1페이지 명령 testid 누락: ${id}`).toContain(id);
      expect(actual.page2.testids, `${id} 가 2페이지에 새어 나왔다`).not.toContain(id);
    }
    for (const id of PAGE2_ONLY_COMMAND_TESTIDS) {
      expect(actual.page2.testids, `2페이지 명령 testid 누락: ${id}`).toContain(id);
      expect(actual.page1.testids, `${id} 가 1페이지에 새어 나왔다`).not.toContain(id);
    }
    // 고급 조건 목록은 2페이지 전용(any 묶음 + gold 는 고정 행에 자리가 없다).
    expect(
      actual.page2.testids.filter((t) => t.startsWith("event-page-advanced-condition-row-")).length,
      "2페이지 고급 조건 행이 없다 — 묶음/gold 조건 렌더가 죽었다",
    ).toBeGreaterThan(0);
    expect(actual.page1.testids.filter((t) => t.startsWith("event-page-advanced-condition-row-"))).toEqual([]);
    expect(shellDiff(actual.page1, actual.page2).length).toBeGreaterThan(0);
  });

  it("details→div 후처리가 실제로 발동한다", () => {
    if (crashed.length) return;
    for (const key of ["page1", "page2"] as const) {
      const counts = actual[key].counts;
      expect(
        counts.detailsConverted,
        `${key}: details→div 변환이 0건 — 픽스처가 content.ts:228 후처리 경로를 타지 않는다 ` +
          `(NPC 관계 연결/설정 그룹이 비었는지 확인하라)`,
      ).toBeGreaterThan(0);
      expect(
        counts.detailsUnconverted,
        `${key}: ${DETAILS_AUTHORED_CLASSES.join("/")} 중 details 로 남은 노드가 있다 — 후처리가 일부를 놓쳤다`,
      ).toBe(0);
    }
    // 후처리 예외(일정 편집기)는 details 로 살아 있어야 한다 — 예외까지 갈아 버린 회귀를 잡는다.
    const exemptTags = DETAILS_EXEMPT_TESTIDS.map((id) => actual.page1.tagByTestid[id]).filter(Boolean);
    expect(exemptTags.length, "후처리 예외 대상 testid 가 셸에서 사라졌다").toBeGreaterThan(0);
    for (const tag of exemptTags) expect(tag).toBe("details");
  });

  /**
   * `bare` 변형이 실제로 «새 이벤트» 분기를 타는지 못 박는다. 이게 없으면 픽스처가 조용히
   * page1 과 같아져도(조건이 다시 채워지거나 characterId 가 살아나도) 기준선만 갱신하면 초록이다.
   * 즉 변형 항목이 하나 더 있다는 사실 자체는 아무것도 보증하지 않는다.
   */
  it("bare 변형이 미연결·조건0 분기를 실제로 렌더한다", () => {
    if (crashed.length) return;
    expect(
      actual.bare.testids,
      "조건 0개 요약 배지가 없다 — bare 픽스처의 조건이 비어 있지 않다(pageProps.ts:977)",
    ).toContain("event-condition-summary-empty");
    expect(
      actual.bare.classes,
      "is-unlinked 가 없다 — bare 픽스처에 characterId 가 살아 있다(pageProps.ts:395)",
    ).toContain("is-unlinked");
    // 반대 방향: 설정된 상태에서는 두 분기가 나오지 않아야 한다(변형이 진짜 변형임을 증명).
    expect(actual.page1.testids).not.toContain("event-condition-summary-empty");
    expect(actual.page1.classes).not.toContain("is-unlinked");
    expect(actual.page1.classes, "연결 상태 클래스가 사라졌다").toContain("is-linked");
  });

  /**
   * `allRows` 변형이 정말 13행을 다 켜는지 못 박는다. bare 계약과 같은 이유이지만, 여기서는
   * **칩 UI 의 성질 때문에 훨씬 조용히 죽는다** — 픽스처에서 조건 하나를 빼면 그 행의 표면 전체가
   * 사라지는데, 개수 단정이 없으면 기준선 갱신 한 번으로 초록이 된다. 실측으로 그 경로를 밟았다:
   * page1+page2 만 있던 시절 정본이 `.timer` `.friendship` `.npc-activity`
   * `.event-condition-time-unit` `.event-condition-friendship-hint` 5종을 잃었다.
   */
  it("allRows 변형이 고정 조건 13행을 전부 켠다", () => {
    if (crashed.length) return;
    const chips = actual.allRows.testids.filter((t) => t.startsWith("event-condition-chip-"));
    expect(chips.length, "조건 칩이 13개가 아니다 — pageConditions.ts 의 행 정의가 바뀌었다").toBe(13);
    // 13행인데 testid 는 12종이다 — switch1·switch2 가 라벨 "스위치" 를 공유해
    // `event-condition-row-스위치` 로 겹친다(pageConditions.ts:53,62). 선행 문제이고
    // 아래 컨트롤 키의 `~1` 접미사가 두 행이 다 렌더됐음을 증명한다.
    const rows = actual.allRows.testids.filter((t) => t.startsWith("event-condition-row-"));
    expect(
      rows.length,
      `켜진 조건 행 testid 가 12종이 아니다(${rows.length}종) — ALL_ROW_CONDITIONS 가 어떤 kind 를 놓쳤다`,
    ).toBe(12);
    expect(
      Object.keys(actual.allRows.controls),
      "스위치 행이 하나뿐이다 — switch1/switch2 두 행이 다 켜졌는지 확인하라",
    ).toContain("event-condition-row-스위치>input#0~1");
    // 정본이 실제로 잃었던 5종을 이름으로 다시 못 박는다 — 개수만 보면 다른 행으로 채워도 통과한다.
    for (const cls of [
      "timer",
      "friendship",
      "npc-activity",
      "event-condition-time-unit",
      "event-condition-friendship-hint",
    ]) {
      expect(actual.allRows.classes, `allRows 에 .${cls} 가 없다`).toContain(cls);
    }
    // 반대 방향: 이 5종은 page1/page2/bare 로는 도달할 수 없다(그래서 이 변형이 필요하다).
    for (const key of ["page1", "page2", "bare"] as const) {
      expect(
        actual[key].classes,
        `${key} 가 .event-condition-friendship-hint 를 렌더한다 — allRows 변형이 불필요해졌으니 이 계약을 다시 써라`,
      ).not.toContain("event-condition-friendship-hint");
    }
  });

  it("기준선과 일치한다", () => {
    if (crashed.length) {
      // 크래시면 기준선 대조를 건너뛴다 — 빈 표면 vs 기준선 diff 는 «표면이 달라졌다»로
      // 원인을 묻어 버린다. 크래시 자체를 여기서도 실패로 못 박는다.
      expect(
        crashed.map(([key]) => key),
        "렌더 크래시로 기준선 대조를 건너뜀 — 위 «예외 없이 렌더된다» 테스트의 스택을 보라",
      ).toEqual([]);
      return;
    }
    assertSurfaceGate<ShellSurface>({
      axis: "셸",
      baselinePath: BASELINE,
      floorPath: FLOOR,
      updateEnv: "SHELL_SURFACE_UPDATE",
      actual,
      diff: (_key, before, after) => shellDiff(before, after),
      metrics: shellMetrics,
    });
  });
});

describe("크래시 진단은 스택 4프레임을 담는다", () => {
  function deep(): never {
    throw new TypeError("셸 렌더가 터졌다");
  }
  function middle(): never {
    return deep();
  }

  it("name/message 뒤에 프레임이 붙는다", () => {
    let formatted = "";
    try {
      middle();
    } catch (e) {
      formatted = formatCaptureError(e);
    }
    const lines = formatted.split("\n");
    expect(lines[0]).toBe("TypeError: 셸 렌더가 터졌다");
    // 프레임이 없으면 예전과 똑같이 «무엇이 터졌는지만 아는» 상태로 되돌아간다.
    expect(lines.length, `스택 프레임이 없다: ${formatted}`).toBeGreaterThan(1);
    expect(lines.length, "프레임을 4개보다 많이 담았다(800자 상한 전에 스택이 로그를 삼킨다)").toBeLessThanOrEqual(5);
    expect(formatted).toContain("deep");
    expect(formatted.length).toBeLessThanOrEqual(800);
  });

  it("Error 가 아닌 값도 삼키지 않는다", () => {
    expect(formatCaptureError("문자열 throw").split("\n")[0]).toBe("Unknown: 문자열 throw");
  });
});

describe("countDetailsConversion 은 미변환 details 를 실제로 구분한다", () => {
  // detailsConverted > 0 단정만으로는 «측정 자체가 항상 0/항상 통과» 인지 알 수 없다.
  // 측정 함수가 div/details 를 갈라 보는지 여기서 직접 못 박는다.
  function column(inner: string): HTMLElement {
    const root = document.createElement("div");
    root.innerHTML = `<div class="event-editor-settings-column">${inner}</div>`;
    return root;
  }

  it("div 로 바뀐 노드를 converted 로 센다", () => {
    expect(countDetailsConversion(column(`<div class="event-collapsible-section"></div>`))).toEqual({
      converted: 1,
      unconverted: 0,
    });
  });

  it("details 로 남은 노드를 unconverted 로 센다 (후처리 소실 시나리오)", () => {
    expect(
      countDetailsConversion(
        column(
          `<details class="event-character-social-extras">` +
            `<details class="event-character-social-advanced"></details></details>`,
        ),
      ),
    ).toEqual({ converted: 0, unconverted: 2 });
  });

  it("설정 칼럼이 없으면 0을 낸다 (칼럼 자체가 사라진 회귀는 detailsConverted 0 으로 잡힌다)", () => {
    const root = document.createElement("div");
    root.innerHTML = `<details class="event-collapsible-section"></details>`;
    expect(countDetailsConversion(root)).toEqual({ converted: 0, unconverted: 0 });
  });
});

describe("stableKey 는 래퍼 div 삽입에 불변이다", () => {
  function controlKeys(root: HTMLElement): string[] {
    return Array.from(root.querySelectorAll("input, select, textarea, button")).map((n) => stableKey(root, n));
  }
  function wrapInDiv(node: Element): void {
    const wrapper = document.createElement("div");
    node.parentElement?.insertBefore(wrapper, node);
    wrapper.append(node);
  }

  it("testid 조상 아래 컨트롤의 키가 래퍼 전후로 같다", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div data-testid="host-a">
        <span><select><option value="x"></option></select></span>
        <button type="button"></button>
        <select><option value="y"></option></select>
      </div>
      <div data-testid="host-b"><input type="checkbox" /><input type="text" /></div>`;
    const before = controlKeys(root);
    expect(before).toEqual([
      "host-a>select#0",
      "host-a>button#0",
      "host-a>select#1",
      "host-b>input#0",
      "host-b>input#1",
    ]);
    for (const node of Array.from(root.querySelectorAll("select, input"))) wrapInDiv(node);
    expect(controlKeys(root), "래퍼 div 삽입이 키를 흔들었다").toEqual(before);
  });

  it("testid 조상이 없으면 :root 폴백을 쓰고, 그 키도 래퍼에 불변이다", () => {
    const root = document.createElement("div");
    root.innerHTML = `<span><button type="button"></button></span><button type="button"></button>`;
    const before = controlKeys(root);
    expect(before).toEqual([":root>button#0", ":root>button#1"]);
    for (const node of Array.from(root.querySelectorAll("button"))) wrapInDiv(node);
    expect(controlKeys(root)).toEqual(before);
  });

  it("자기 testid 가 있으면 그걸 쓴다(위치 무관)", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div data-testid="host"><span><input data-testid="named" /></span></div>`;
    expect(controlKeys(root)).toEqual(["named"]);
  });
});

describe("셸 게이트가 실제로 변이를 잡는다 (합성 변이)", () => {
  // src/ 를 고칠 수 없으므로 수확 결과를 깊은 복사해 변이시킨다.
  const clone = (s: ShellSurface): ShellSurface => JSON.parse(JSON.stringify(s)) as ShellSurface;
  // 재수확하지 않고 page2 표면을 그대로 쓴다(추가 렌더가 모듈 전역을 건드리는 것을 피한다).
  const base = actual.page2;

  const cases: { readonly name: string; readonly mutate: (s: ShellSurface) => string }[] = [
    {
      name: "tagByTestid 항목을 details→div 로 바꾼다",
      mutate: (s) => {
        const entry = Object.entries(s.tagByTestid).find(([, tag]) => tag === "details");
        if (!entry) return "details 태그 항목이 없다";
        s.tagByTestid[entry[0]] = "div";
        s.tags.details = (s.tags.details ?? 1) - 1;
        s.tags.div = (s.tags.div ?? 0) + 1;
        return "";
      },
    },
    {
      name: "클래스 1개를 제거한다",
      mutate: (s) => {
        if (!s.classes.length) return "클래스가 없다";
        s.classes.splice(0, 1);
        s.counts.classCount -= 1;
        return "";
      },
    },
    {
      // 실측 플래그 분포(page1+page2): inHidden 45 / disabled 8 / checked 9.
      // 셸에 `hidden` 을 직접 단 컨트롤은 없고(숨는 것은 조상 cmd-list·preview-host 다) inHidden 이 그 자리다.
      name: "controls 값에서 숨김/비활성 플래그를 지운다",
      mutate: (s) => {
        const entry =
          Object.entries(s.controls).find(([, v]) => /\{[^}]*(hidden|Hidden)/.test(v)) ??
          Object.entries(s.controls).find(([, v]) => v.includes("{"));
        if (!entry) return "플래그를 가진 컨트롤이 없다";
        s.controls[entry[0]] = entry[1].replace(/\{[^}]*\}/, "");
        return "";
      },
    },
    {
      name: "selectOptions 항목을 절단한다",
      mutate: (s) => {
        const entry = Object.entries(s.selectOptions).find(([, v]) => v.length >= 2);
        if (!entry) return "옵션 2개 이상인 select 가 없다";
        s.selectOptions[entry[0]] = entry[1].slice(0, 1);
        return "";
      },
    },
    {
      name: "testid 1개를 제거한다",
      mutate: (s) => {
        if (!s.testids.length) return "testid 가 없다";
        s.testids.splice(0, 1);
        s.counts.testidCount -= 1;
        return "";
      },
    },
    {
      name: "detailsConverted 를 0으로 떨어뜨린다",
      mutate: (s) => {
        s.counts.detailsConverted = 0;
        return "";
      },
    },
    {
      name: "라벨 1개를 제거한다",
      mutate: (s) => {
        if (!s.labels.length) return "라벨이 없다";
        s.labels.splice(0, 1);
        s.counts.labelCount -= 1;
        return "";
      },
    },
  ];

  for (const testCase of cases) {
    it(`${testCase.name} → diff 가 보고한다`, () => {
      expect(base.error, `수확이 크래시해서 변이를 증명할 수 없다: ${base.error}`).toBeUndefined();
      const mutated = clone(base);
      const skip = testCase.mutate(mutated);
      expect(skip, `변이를 적용할 대상이 없다: ${skip}`).toBe("");
      const report = shellDiff(base, mutated);
      expect(report.length, `${testCase.name}: diff 가 침묵했다`).toBeGreaterThan(0);
    });
  }

  it("변이가 없으면 diff 는 침묵한다", () => {
    expect(shellDiff(base, clone(base))).toEqual([]);
  });
});

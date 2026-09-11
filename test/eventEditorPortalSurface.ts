// test/eventEditorPortalSurface.ts
//
// **포털(피커/모달) 표면 수확기** — `document.body` 로 렌더되는 이벤트 에디터 표면 축.
//
// ── 왜 이 축이 필요한가 (실측) ────────────────────────────────────────────────────
//   이벤트 에디터의 피커·모달은 폼 컨테이너가 아니라 `document.body` 에 붙는다
//   (`subdialog.ts` 의 `document.body.append(backdrop)`, `commandListContextMenu.ts`,
//   `eventEditorHelp.ts`, `characterIdAutocomplete.ts` 의 폴백 경로).
//   그래서 폼 / M2 / 셸 축은 이 표면을 하나도 보지 못한다. 실측: 폼 60/202 개가 상호작용 후
//   표면이 바뀌고 그때 생기는 피커 testid 1,928개가 축 밖으로 나갔다.
//
//   CSS 게이트로 정량화한 결과, 표면 기준선을 정본으로 쓰는 새 CSS 게이트에서도
//     · src/styles/event/event-editor.part-3/06-event-command-picker-favorite.css (456줄)
//     · src/styles/event/event-editor.p1-route.css (117줄)
//   을 통째로 비워도 게이트가 통과했다. 어떤 축도 이 클래스들을 렌더로 증명하지 못했기 때문이다.
//   즉 이 축이 없으면 "명령 피커를 리팩터하다 즐겨찾기 UI 를 통째로 날려도 모든 게이트가 초록"이다.
//
// ── 이 축 특유의 위험: 격리 ────────────────────────────────────────────────────────
//   포털은 전역(`document.body`, `localStorage`, 모달 스택, editorState)에 붙는다. 정리에
//   실패하면 기준선이 **수확 순서에 의존**한다. 그래서:
//     1) 포털 하나마다 `resetWorld()` 로 body / localStorage / 모달 스택 / editorState 를 초기화한다.
//     2) 열기 직전 body 자식 집합을 기록해 **차집합**만 수확한다(무엇이 이 포털의 산출물인지 확정).
//     3) 수확 후 `cleanupWorld()` 로 반드시 되돌린다.
//   그리고 `captureAllPortalSurfaces({ reverse: true })` 로 순서를 뒤집어도 같은 결과가
//   나오는지 게이트 테스트가 확인한다(baseline.test.ts 의 "격리 증명").
//
// 최상위 `classes: string[]` 는 이름을 바꾸지 마라 — `scripts/check-css-live-classes.mjs` 가
// 표면 기준선 JSON 을 재귀로 훑어 모든 `classes` 배열을 "실사용 CSS 클래스 정본"으로 읽는다.
// 이름을 바꾸거나 중첩 밖으로 빼면 이 축의 CSS 보호가 0이 된다.
import { editorState } from "@/editor/editorState";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { attachCharacterIdAutocomplete } from "@/editor/panels/eventEditor/characterIdAutocomplete";
import { openCharacterIdPicker } from "@/editor/panels/eventEditor/characterIdPickerDialog";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { openCommandContextMenu } from "@/editor/panels/eventEditor/commandListContextMenu";
import {
  eventCommandPickerSearchEntries,
  openEventCommandPicker,
} from "@/editor/panels/eventEditor/commandPicker";
import { openEventEditorHelp } from "@/editor/panels/eventEditor/eventEditorHelp";
import { openFieldMonsterTemplateDialog } from "@/editor/panels/eventEditor/fieldMonsterTemplateDialog";
import { openNpcGraphicDialog } from "@/editor/panels/eventEditor/graphicDialog";
import { openMapPointDialog } from "@/editor/panels/eventEditor/mapPointDialog";
import { openPageMoveRouteDialog } from "@/editor/panels/eventEditor/moveRouteDialog";
import { openRecordPickerPanel } from "@/editor/panels/eventEditor/recordPickerPanel";
import { openTransferPlayerDialog } from "@/editor/panels/eventEditor/transferPlayerDialog";
import { store } from "@/project/store";
import type { EventPage, GameEvent, MapId, Project } from "@/project/types";
import { createCaptureProject } from "./fixtures/captureProject";
import type { FloorMetrics } from "./surfaceGateSupport";

/** 포털 표면. `classes` 는 CSS 게이트 정본이라 키 이름을 바꾸면 안 된다. */
export type PortalSurface = {
  readonly testids: string[];
  readonly classes: string[];
  readonly tags: Record<string, number>;
  readonly tagByTestid: Record<string, string>;
  /** stableKey → `tag[type]{hidden,disabled,checked,readonly,required}` */
  readonly controls: Record<string, string>;
  readonly selectOptions: Record<string, string[]>;
  readonly labels: string[];
  readonly testidCount: number;
  readonly controlCount: number;
  readonly classCount: number;
  /** body 에 새로 붙은 최상위 노드 수. 0 = 포털이 아무것도 렌더하지 않았다. */
  readonly rootCount: number;
  readonly error?: string;
};

const CONTROL_TAGS: ReadonlySet<string> = new Set(["button", "input", "select", "textarea"]);
/** 옵션이 이보다 많은 select 는 `["<n개>", 첫값, 마지막값]` 로 압축한다(아래 harvest 주석 참고). */
const SELECT_OPTION_CAP = 50;
const ERROR_TEXT_LIMIT = 800;
const ERROR_STACK_FRAMES = 4;

// ── 수확 (순수 함수) ──────────────────────────────────────────────────────────────

/**
 * 주어진 최상위 노드들(= 포털이 body 에 새로 붙인 것)에서 표면을 수확한다.
 *
 * 순수 함수로 분리한 이유: (a) stableKey 의 래퍼 불변성을 DOM 조립만으로 증명할 수 있고,
 * (b) 합성 변이 증명이 실제 포털을 열지 않고도 가능하다.
 */
export function harvestPortal(roots: readonly Element[], error?: string): PortalSurface {
  const elements = flatten(roots);
  const keys = stableKeys(elements);

  const testids = new Set<string>();
  const classes = new Set<string>();
  const tags: Record<string, number> = {};
  const tagByTestid: Record<string, string> = {};
  const controls: Record<string, string> = {};
  const selectOptions: Record<string, string[]> = {};
  const labels = new Set<string>();

  for (const node of elements) {
    const tag = node.tagName.toLowerCase();
    tags[tag] = (tags[tag] ?? 0) + 1;
    for (const token of node.classList) classes.add(token);
    const testid = testidOf(node);
    if (testid) {
      testids.add(testid);
      tagByTestid[testid] = tag;
    }
    if (CONTROL_TAGS.has(tag)) {
      const key = keys.get(node) ?? `:orphan>${tag}`;
      controls[key] = controlSignature(node, tag);
      if (tag === "select") selectOptions[key] = optionValues(node);
    }
    collectLabels(node, tag, labels);
  }

  return {
    testids: sorted(testids),
    classes: sorted(classes),
    tags: sortRecord(tags),
    tagByTestid: sortRecord(tagByTestid),
    controls: sortRecord(controls),
    selectOptions: sortRecord(selectOptions),
    labels: sorted(labels),
    testidCount: testids.size,
    controlCount: Object.keys(controls).length,
    classCount: classes.size,
    rootCount: roots.length,
    ...(error === undefined ? {} : { error }),
  };
}

/**
 * 노드마다 리팩터에 견디는 키를 만든다.
 *
 *   1) 자신에게 testid 가 있으면 그 testid.
 *   2) 없으면 `가장 가까운 조상 testid > tagName # 그 조상 서브트리 내 같은 tagName 의 0-base 서수`.
 *   3) 조상 testid 도 없으면 `:root>tagName#n`(수확 포레스트 전체 문서순 서수).
 *
 * 래퍼 div 를 하나 더 감싸도 컨트롤(button/input/select/textarea) 키는 변하지 않는다 —
 * 서수는 같은 tagName 안에서만 세므로 div 추가가 input 의 서수를 밀지 못한다.
 * (baseline.test.ts 의 "래퍼 불변성" 테스트가 이 성질을 증명한다.)
 */
function stableKeys(elements: readonly Element[]): Map<Element, string> {
  const keys = new Map<Element, string>();
  const counters = new Map<string, number>();
  for (const node of elements) {
    const own = testidOf(node);
    if (own) {
      keys.set(node, own);
      continue;
    }
    const tag = node.tagName.toLowerCase();
    const scope = nearestTestidAncestor(node);
    const prefix = scope ?? ":root";
    const bucket = `${prefix}>${tag}`;
    const index = counters.get(bucket) ?? 0;
    counters.set(bucket, index + 1);
    keys.set(node, `${bucket}#${index}`);
  }
  return keys;
}

function nearestTestidAncestor(node: Element): string | null {
  let parent = node.parentElement;
  while (parent) {
    const testid = testidOf(parent);
    if (testid) return testid;
    parent = parent.parentElement;
  }
  return null;
}

function testidOf(node: Element): string | null {
  const value = node.getAttribute("data-testid");
  return value && value.length > 0 ? value : null;
}

function controlSignature(node: Element, tag: string): string {
  const type = node.getAttribute("type") ?? "";
  const flags: string[] = [];
  const html = node as HTMLElement & {
    disabled?: boolean;
    checked?: boolean;
    readOnly?: boolean;
    required?: boolean;
  };
  if (html.hidden === true) flags.push("hidden");
  if (html.disabled === true) flags.push("disabled");
  if (html.checked === true) flags.push("checked");
  if (html.readOnly === true) flags.push("readonly");
  if (html.required === true) flags.push("required");
  return `${tag}[${type}]{${flags.join(",")}}`;
}

/**
 * select 옵션 **값**은 마스킹하지 않는다 — enum 선택지 유실을 잡는 게 목적이라 값이 정본이다.
 * 다만 DB 열거 select(아이템·스위치 등)는 옵션이 수백 개가 되어 기준선을 카탈로그 증감에
 * 묶어 버리므로, SELECT_OPTION_CAP 을 넘으면 `["<n개>", 첫값, 마지막값]` 로 압축한다.
 */
function optionValues(node: Element): string[] {
  const options = Array.from(node.querySelectorAll("option")).map((option) =>
    option.getAttribute("value") ?? (option.textContent ?? "")
  );
  if (options.length <= SELECT_OPTION_CAP) return options;
  return [`<${options.length}개>`, options[0] ?? "", options[options.length - 1] ?? ""];
}

/** 라벨/설명 텍스트. DB 잡음을 줄이려고 숫자는 `#` 로 마스킹한다. */
function collectLabels(node: Element, tag: string, out: Set<string>): void {
  if (["label", "legend", "h1", "h2", "h3", "h4", "th", "caption"].includes(tag)) {
    const text = (node.textContent ?? "").replace(/\s+/gu, " ").trim();
    if (text.length > 0) out.add(mask(text));
  }
  for (const attribute of ["aria-label", "placeholder", "title"]) {
    const value = node.getAttribute(attribute);
    if (value && value.trim().length > 0) out.add(mask(value.trim()));
  }
}

function mask(text: string): string {
  return text.replace(/\d+/gu, "#");
}

function flatten(roots: readonly Element[]): Element[] {
  const out: Element[] = [];
  for (const root of roots) {
    out.push(root);
    for (const node of root.querySelectorAll("*")) out.push(node);
  }
  return out;
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of sorted(Object.keys(record))) out[key] = record[key] as T;
  return out;
}

// ── 고정 세계 (포털 하나마다 새로) ────────────────────────────────────────────────

const CAPTURE_EVENT_ID = "ev_portal_capture";
const CAPTURE_PAGE_ID = "pg_portal_capture";
const CAPTURE_CHARACTER_ID = "npc_portal_capture";

/** 픽커 preferences 가 쓰는 localStorage 키. 수확 사이에 반드시 지운다. */
const PICKER_STORAGE_KEYS = [
  "oprn:eventCommandPicker.favorites",
  "oprn:eventCommandPicker.recents",
  "oprn:eventCommandPicker.viewMode",
];

/**
 * 즐겨찾기·최근 상태를 만들 때 쓰는 commandId.
 *
 * 픽커는 `byId.get(id)` 로만 해석하므로 **엉뚱한 id 를 넣으면 즐겨찾기 섹션이 조용히 0줄**이
 * 되고, 그러면 06-event-command-picker-favorite.css 는 다시 무보증이 된다. 그래서 카탈로그
 * 순서에 의존하지 않는 고정 id 를 박고, baseline.test.ts 가 이 id 들이 실재하는지 하드
 * 계약으로 확인한다(해석 실패 = 테스트 실패).
 */
export const PORTAL_FAVORITE_COMMAND_IDS: readonly string[] = ["setWeather", "showAnimation"];
export const PORTAL_RECENT_COMMAND_IDS: readonly string[] = ["setLighting", "addLight"];

/** 위 고정 id 중 픽커 항목으로 해석되지 않는 것. 비어 있어야 한다. */
export function unresolvableQuickCommandIds(): string[] {
  const known = new Set(eventCommandPickerSearchEntries().map((entry) => entry.commandId));
  return [...PORTAL_FAVORITE_COMMAND_IDS, ...PORTAL_RECENT_COMMAND_IDS].filter((id) => !known.has(id));
}

type CaptureWorld = {
  readonly mapId: MapId;
  readonly eventId: string;
  readonly page: EventPage;
};

/**
 * 페이지 조건에 스위치를 하나 물린다 — 레코드 피커의 "이 맵에서 쓰는 중" 섹션
 * (`event-record-picker-section`)은 `mapUsageOf(id) > 0` 일 때만 렌더된다. 즉 맵이 그 레코드를
 * 실제로 참조해야 섹션 헤딩 UI 가 축에 들어온다.
 */
function capturePage(switchId: string): EventPage {
  return {
    id: CAPTURE_PAGE_ID,
    name: "포털 캡처 페이지",
    conditions: switchId ? [{ kind: "switch", switchId, value: true }] : [],
    graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, direction: "down", pattern: 1 },
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    movement: { type: "custom", speed: 3, frequency: 3, route: { moves: [{ kind: "move", dir: "up" }], repeat: true } },
    commands: [{ kind: "text", body: "포털 캡처" }],
  };
}

function captureEvent(switchId: string): GameEvent {
  const page = capturePage(switchId);
  return {
    id: CAPTURE_EVENT_ID,
    characterId: CAPTURE_CHARACTER_ID,
    x: 3,
    y: 4,
    trigger: { kind: "action" },
    commands: [],
    pages: [page],
  };
}

/**
 * 포털 하나를 열기 직전의 세계 초기화. **여기서 빠뜨린 전역이 곧 순서 의존성이다.**
 */
function resetWorld(): CaptureWorld {
  cleanupWorld();
  const project: Project = createCaptureProject();
  const mapId = project.startMapId;
  // 스위치 id 는 픽스처가 정하지 않는다 — store.replace 의 ensureSwitchVariableSlots 가 슬롯을
  // 채우므로, 정본은 언제나 "캡처 프로젝트의 첫 스위치"다.
  const switchId = project.switches[0]?.id ?? "";
  const event = captureEvent(switchId);
  const map = project.maps[mapId];
  if (map) map.events = [event];
  project.characters = { [CAPTURE_CHARACTER_ID]: { displayName: "포털 캡처 NPC" } };
  store.replace(project, { preserveEventDrafts: false });
  // currentMapId 는 켠다 — 레코드 피커의 맵 스코프 섹션이 이걸로 갈린다.
  // 반면 selectedEventId 는 반드시 끈다: previewMoveRoute 가 그 값으로 "맵 위 경로 오버레이"
  // (비동기 캔버스)를 켜므로, 동기 수확이 타이밍에 의존하게 된다.
  editorState.set({ currentMapId: mapId, selectedEventId: null, selectedEventPageId: null });
  return { mapId, eventId: event.id, page: event.pages?.[0] ?? capturePage(switchId) };
}

/** 포털이 남긴 전역 잔재를 전부 걷는다. */
function cleanupWorld(): void {
  resetModalStackForTest();
  document.body.innerHTML = "";
  document.body.className = "";
  document.body.removeAttribute("style");
  try {
    for (const key of PICKER_STORAGE_KEYS) globalThis.localStorage?.removeItem(key);
  } catch {
    // storage 미지원 환경은 무시(픽커도 같은 방어를 한다).
  }
}

// ── 포털 목록 ────────────────────────────────────────────────────────────────────

type PortalDefinition = {
  readonly key: string;
  readonly open: (world: CaptureWorld) => void;
};

function noop(): void {
  return undefined;
}

function pickerRequest(): Parameters<typeof openEventCommandPicker>[0] {
  return { title: "명령 추가", context: "map", onSelect: noop };
}

function pickerSearchInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('[data-testid="event-command-picker-search"]');
  if (!input) throw new Error("명령 피커 검색 input 을 찾을 수 없다 — 픽커 렌더가 바뀌었다");
  return input;
}

function typeInPicker(query: string): void {
  const input = pickerSearchInput();
  input.value = query;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * 선택 불가(정보) 행을 띄우는 검색어.
 *
 * 정보 행(`.event-command-picker-command.is-informational` + `command-picker-guidance-*`)은 탭
 * 그리드에 절대 안 나오고 **검색 결과에서만** 보인다. 그래서 기본 열기·탭 상태만 수확하면 이
 * UI 는 영구 무보증이다. 검색어를 손으로 박으면 라벨이 바뀔 때 조용히 안 맞게 되므로,
 * 카탈로그에서 첫 선택 불가 항목의 라벨을 그대로 쓴다(없으면 실패시킨다).
 */
function informationalQuery(): string {
  const entry = eventCommandPickerSearchEntries().find((candidate) => !candidate.selectable);
  if (!entry) throw new Error("선택 불가(정보) 픽커 항목이 없다 — is-informational 상태를 만들 수 없다");
  return entry.label;
}

function clickPickerTab(page: 1 | 2 | 3 | 4): void {
  const tab = document.querySelector<HTMLButtonElement>(`[data-testid="event-command-picker-tab-${page}"]`);
  if (!tab) throw new Error(`명령 피커 탭 ${page} 버튼이 없다`);
  tab.click();
}

function writePickerStorage(entries: Record<string, readonly string[] | string>): void {
  for (const [key, value] of Object.entries(entries)) {
    globalThis.localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  }
}

/**
 * 수확 대상. 순서는 기준선 JSON 의 키 순서이기도 하다(격리 증명은 이 순서를 뒤집는다).
 *
 * 명령 피커는 **상태별로** 여러 번 수확한다. 기본 열기만 보면 즐겨찾기·검색·그리드 UI 가
 * 전부 축 밖에 남고, 그게 06-event-command-picker-favorite.css 456줄이 무보증이던 이유다.
 */
const PORTAL_DEFINITIONS: readonly PortalDefinition[] = [
  { key: "commandPicker", open: () => openEventCommandPicker(pickerRequest()) },
  {
    key: "commandPickerTab2",
    open: () => {
      openEventCommandPicker(pickerRequest());
      clickPickerTab(2);
    },
  },
  {
    key: "commandPickerTab3",
    open: () => {
      openEventCommandPicker(pickerRequest());
      clickPickerTab(3);
    },
  },
  {
    key: "commandPickerTab4",
    open: () => {
      openEventCommandPicker(pickerRequest());
      clickPickerTab(4);
    },
  },
  {
    key: "commandPickerSearch",
    open: () => {
      openEventCommandPicker(pickerRequest());
      typeInPicker("날씨");
    },
  },
  {
    key: "commandPickerSearchInformational",
    open: () => {
      openEventCommandPicker(pickerRequest());
      typeInPicker(informationalQuery());
    },
  },
  {
    key: "commandPickerSearchEmpty",
    open: () => {
      openEventCommandPicker(pickerRequest());
      typeInPicker("존재하지않는명령zzz");
    },
  },
  {
    key: "commandPickerFavorites",
    open: () => {
      writePickerStorage({
        "oprn:eventCommandPicker.favorites": PORTAL_FAVORITE_COMMAND_IDS,
        "oprn:eventCommandPicker.recents": PORTAL_RECENT_COMMAND_IDS,
      });
      openEventCommandPicker(pickerRequest());
    },
  },
  {
    key: "commandPickerGrid",
    open: () => {
      writePickerStorage({ "oprn:eventCommandPicker.viewMode": "grid" });
      openEventCommandPicker(pickerRequest());
    },
  },
  {
    key: "pageMoveRoute",
    open: (world) =>
      openPageMoveRouteDialog({
        movement: world.page.movement,
        onApply: noop,
      }),
  },
  { key: "npcGraphic", open: (world) => openNpcGraphicDialog(world.mapId, world.eventId, world.page) },
  {
    key: "mapPoint",
    open: (world) =>
      openMapPointDialog({
        title: "목적지 선택",
        point: { mapId: world.mapId, x: 5, y: 6 },
        testIdPrefix: "event-page-npc-living-destination",
        onApply: noop,
      }),
  },
  {
    key: "characterIdPicker",
    open: (world) =>
      openCharacterIdPicker({
        mapId: world.mapId,
        eventId: world.eventId,
        currentId: CAPTURE_CHARACTER_ID,
      }),
  },
  {
    // 실측 결함(고치지 않음): 맵 트리 행(`transfer-player-map-row`)은 이 축에 잡히지 않는다.
    // transferPlayerDialog 는 초기 렌더에서 트리 호스트만 붙이고, 실제 트리는
    // requestAnimationFrame **두 번** 뒤 rerenderAll() 에서 그린다. 동기 수확은 그 이전을 본다.
    // 즉 다이얼로그가 열린 첫 두 프레임 동안 저작자에게도 맵 목록이 비어 보인다.
    key: "transferPlayer",
    open: (world) =>
      openTransferPlayerDialog({
        command: { kind: "transfer", mapId: world.mapId, x: 2, y: 3, direction: "down", fade: "black" },
        onApply: noop,
      }),
  },
  {
    key: "fieldMonsterTemplate",
    open: (world) => openFieldMonsterTemplateDialog(world.mapId, world.eventId, world.page),
  },
  {
    key: "recordPickerSwitch",
    open: () =>
      openRecordPickerPanel({
        kind: "switch",
        currentId: store.getCurrent().switches[0]?.id ?? "",
        onSelect: noop,
      }),
  },
  {
    key: "recordPickerItem",
    open: () =>
      openRecordPickerPanel({
        kind: "item",
        currentId: store.getCurrent().database.items[0]?.id ?? "",
        onSelect: noop,
      }),
  },
  {
    key: "commandEditDialog",
    open: () =>
      openEventCommandEditDialog({
        initial: { kind: "text", body: "포털 캡처 대사" },
        onApply: noop,
        lockKind: true,
      }),
  },
  {
    key: "commandListContextMenu",
    open: (world) => {
      // 메뉴는 클릭 좌표에서 열린다. 앵커 노드는 body 밖(분리 상태)에 둬서 차집합에 섞이지 않게 한다.
      const anchor = document.createElement("div");
      anchor.dataset.testid = "portal-capture-anchor";
      openCommandContextMenu({
        x: 40,
        y: 60,
        item: anchor,
        command: world.page.commands[0] ?? { kind: "text", body: "포털 캡처" },
        path: [0],
        actions: {
          addCommand: noop,
          insertCommand: noop,
          replaceCommand: noop,
          deleteCommand: noop,
          moveCommand: noop,
          moveCommandTo: noop,
        },
        openEditor: noop,
        pickerContext: "map",
      });
    },
  },
  { key: "eventEditorHelp", open: () => openEventEditorHelp() },
  {
    key: "characterIdAutocomplete",
    open: () => {
      // 부모가 없으면 드롭다운을 body 에 fixed 로 붙이는 폴백 경로를 탄다(그게 이 축의 대상).
      const input = document.createElement("input");
      input.type = "text";
      input.dataset.testid = "portal-capture-character-id-input";
      attachCharacterIdAutocomplete({
        input,
        getProject: () => store.getCurrent(),
        onSelect: noop,
      });
      input.dispatchEvent(new Event("input", { bubbles: true }));
    },
  },
];

/**
 * 테스트 환경에서 열 수 없어 의도적으로 제외한 포털. **조용한 절단이 "다 봤다"로 읽히는 게
 * 최악**이므로 목록으로 남기고, baseline.test.ts 가 목록 크기를 숫자로 고정한다.
 */
export const SKIPPED_PORTALS: readonly { readonly key: string; readonly reason: string }[] = [
  {
    key: "openEventEditorModal",
    reason:
      "이벤트 에디터 모달 자체(modal.ts). 셸 표면 축(eventEditorShellSurface)이 이미 전량 감시하므로 "
      + "여기서 또 수확하면 같은 표면이 두 기준선에 갈라져 갱신이 서로 어긋난다.",
  },
  {
    key: "openNewEventEditorModal",
    reason: "modal.ts 의 신규 이벤트 변형. 위와 같은 표면 + store 에 이벤트를 실제로 만들어 세계가 오염된다.",
  },
  {
    key: "openNewEventCommandDialog",
    reason: "commandEditDialog.ts 의 얇은 래퍼 — 같은 다이얼로그를 열므로 commandEditDialog 항목과 표면이 동일하다.",
  },
  {
    key: "openNewEventCommandKindDialog",
    reason: "commandEditDialog.ts 의 얇은 래퍼 — kind 로 초기 명령만 만들어 넘긴다. 표면은 commandEditDialog 와 동일.",
  },
  {
    key: "openEventRailGroupFor",
    reason: "pageProps.ts. document.body 포털이 아니라 폼 레일 안 <details> 그룹을 여는 함수라 이 축의 대상이 아니다.",
  },
  {
    key: "eventScriptModernViews",
    reason: "document.body 에 붙지 않는다(폼 컨테이너 안 렌더). 폼 표면 축의 대상이다.",
  },
];

export const PORTAL_KEYS: readonly string[] = PORTAL_DEFINITIONS.map((definition) => definition.key);

// ── 드라이버 ─────────────────────────────────────────────────────────────────────

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return clamp(`nonError: ${String(error)}`);
  // 스택 앞 4프레임을 남긴다 — 실측: 스택을 버려서 크래시 원인을 찾으려고 별도로 tsc 를 돌린 일이 있다.
  const frames = (error.stack ?? "")
    .split("\n")
    .filter((line) => /^\s*at /u.test(line))
    .slice(0, ERROR_STACK_FRAMES)
    .map((line) => line.trim());
  return clamp([`${error.name}: ${error.message}`, ...frames].join("\n"));
}

function clamp(text: string): string {
  return text.length <= ERROR_TEXT_LIMIT ? text : `${text.slice(0, ERROR_TEXT_LIMIT - 1)}…`;
}

function capturePortal(definition: PortalDefinition): PortalSurface {
  try {
    const world = resetWorld();
    const before = new Set(Array.from(document.body.children));
    definition.open(world);
    const roots = Array.from(document.body.children).filter((node) => !before.has(node));
    return harvestPortal(roots);
  } catch (error) {
    return harvestPortal([], describeError(error));
  } finally {
    cleanupWorld();
  }
}

/**
 * 모든 포털 표면을 수확한다. 키는 포털 이름.
 *
 * `reverse` 는 격리 증명용이다 — 수확 순서를 뒤집어도 결과가 같아야 한다. 반환 객체의 키
 * 순서는 항상 정의 순서로 되돌린다(JSON 직렬화가 삽입 순서를 따르므로, 순서만으로 기준선
 * 파일이 달라지면 md5 결정성이 깨진다).
 */
export function captureAllPortalSurfaces(
  options: { readonly reverse?: boolean } = {}
): Record<string, PortalSurface> {
  const order = options.reverse ? [...PORTAL_DEFINITIONS].reverse() : PORTAL_DEFINITIONS;
  const captured = new Map<string, PortalSurface>();
  for (const definition of order) captured.set(definition.key, capturePortal(definition));
  const out: Record<string, PortalSurface> = {};
  for (const definition of PORTAL_DEFINITIONS) {
    const surface = captured.get(definition.key);
    if (surface) out[definition.key] = surface;
  }
  return out;
}

// ── 게이트 보조 (지표 / diff) ────────────────────────────────────────────────────

export function portalSurfaceMetrics(surface: PortalSurface): FloorMetrics {
  return {
    testidCount: surface.testidCount,
    controlCount: surface.controlCount,
    classCount: surface.classCount,
    rootCount: surface.rootCount,
  };
}

function missing(before: readonly string[], after: readonly string[]): string[] {
  const now = new Set(after);
  return before.filter((value) => !now.has(value));
}

function preview(values: readonly string[], limit = 8): string {
  return values.length <= limit
    ? values.join(", ")
    : `${values.slice(0, limit).join(", ")} … 외 ${values.length - limit}종`;
}

/** 항목별 차이를 사람이 읽는 줄로. 같으면 빈 배열. */
export function diffPortalSurface(_key: string, before: PortalSurface, after: PortalSurface): string[] {
  const lines: string[] = [];

  const lostTestids = missing(before.testids, after.testids);
  const newTestids = missing(after.testids, before.testids);
  if (lostTestids.length) lines.push(`testid 소실 ${lostTestids.length}종: ${preview(lostTestids)}`);
  if (newTestids.length) lines.push(`testid 신규 ${newTestids.length}종: ${preview(newTestids)}`);

  const lostClasses = missing(before.classes, after.classes);
  const newClasses = missing(after.classes, before.classes);
  if (lostClasses.length) lines.push(`클래스 소실 ${lostClasses.length}종: ${preview(lostClasses)}`);
  if (newClasses.length) lines.push(`클래스 신규 ${newClasses.length}종: ${preview(newClasses)}`);

  const lostControls = missing(Object.keys(before.controls), Object.keys(after.controls));
  const newControls = missing(Object.keys(after.controls), Object.keys(before.controls));
  if (lostControls.length) lines.push(`컨트롤 소실 ${lostControls.length}개: ${preview(lostControls)}`);
  if (newControls.length) lines.push(`컨트롤 신규 ${newControls.length}개: ${preview(newControls)}`);
  const changedControls = Object.keys(before.controls)
    .filter((key) => key in after.controls && before.controls[key] !== after.controls[key])
    .map((key) => `${key} ${before.controls[key]}→${after.controls[key]}`);
  if (changedControls.length) {
    lines.push(`컨트롤 상태 변경 ${changedControls.length}개: ${preview(changedControls, 6)}`);
  }

  const optionChanges: string[] = [];
  for (const key of Object.keys(before.selectOptions)) {
    const was = before.selectOptions[key] ?? [];
    const now = after.selectOptions[key];
    if (!now) {
      optionChanges.push(`${key} select 소실(옵션 ${was.length}개)`);
      continue;
    }
    const lost = missing(was, now);
    const added = missing(now, was);
    if (lost.length || added.length) {
      optionChanges.push(
        `${key} 옵션 ${was.length}→${now.length}${lost.length ? ` 소실[${preview(lost, 4)}]` : ""}`
        + `${added.length ? ` 신규[${preview(added, 4)}]` : ""}`
      );
    }
  }
  for (const key of Object.keys(after.selectOptions)) {
    if (!(key in before.selectOptions)) optionChanges.push(`${key} select 신규(옵션 ${after.selectOptions[key]?.length ?? 0}개)`);
  }
  if (optionChanges.length) lines.push(`selectOptions 변경: ${preview(optionChanges, 6)}`);

  const tagSwaps = Object.keys(before.tagByTestid)
    .filter((testid) => testid in after.tagByTestid && before.tagByTestid[testid] !== after.tagByTestid[testid])
    .map((testid) => `${testid} <${before.tagByTestid[testid]}> → <${after.tagByTestid[testid]}>`);
  if (tagSwaps.length) lines.push(`태그 교체 ${tagSwaps.length}개: ${preview(tagSwaps, 6)}`);

  const lostLabels = missing(before.labels, after.labels);
  if (lostLabels.length) lines.push(`라벨 소실 ${lostLabels.length}종: ${preview(lostLabels, 6)}`);

  // 태그 히스토그램은 변한 태그만. 0 이 되면 "그 태그가 통째로 사라졌다"를 강조한다.
  const tagLines: string[] = [];
  for (const tag of sorted(new Set([...Object.keys(before.tags), ...Object.keys(after.tags)]))) {
    const was = before.tags[tag] ?? 0;
    const now = after.tags[tag] ?? 0;
    if (was === now) continue;
    tagLines.push(now === 0 ? `${tag} ${was}→0 (소실)` : `${tag} ${was}→${now}`);
  }
  if (tagLines.length) lines.push(`태그 ${tagLines.join(", ")}`);

  for (const metric of ["rootCount", "testidCount", "controlCount", "classCount"] as const) {
    if (before[metric] !== after[metric]) lines.push(`${metric} ${before[metric]}→${after[metric]}`);
  }
  if ((before.error ?? "") !== (after.error ?? "")) {
    lines.push(`error ${before.error ? "있음" : "없음"}→${after.error ? `있음(${after.error.split("\n")[0]})` : "없음"}`);
  }

  return lines;
}

/** 축 전체 클래스 합집합 — CSS 게이트 정본에 들어가는 양. */
export function portalClassUnion(surfaces: Record<string, PortalSurface>): string[] {
  const union = new Set<string>();
  for (const surface of Object.values(surfaces)) for (const token of surface.classes) union.add(token);
  return sorted(union);
}

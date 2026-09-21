// editor/panels/editActivityPanel.ts
// 편집 행위 로그 조회 창. `editActivityLog` 가 쌓아 둔 감사 기록을 사람이 읽는 표로 낸다.
//
// 왜 이 파일이 있나 (2026-08-29) —
// 기록은 남게 됐는데 **볼 데가 없었다.** 유일한 기록 UI 인 `mapHistoryPanel` 은
// `mapEditHistory` 의 **되돌리기 스택**을 보여 준다. 둘은 다른 자료다:
//   되돌리기 스택 — 50건 상한 · 되돌리면 사라짐 · 새로고침에 소멸 · 라벨 한 줄
//   행위 로그     — 500건 · 되돌려도 남음 · localStorage 로 영속 · 필드 단위 before→after
// 사후에 "방금 뭘 했더니 이렇게 됐나" 를 재구성하는 건 후자만 할 수 있으므로 조회 경로가 필요하다.
//
// ⚠ **`<details>` 를 쓰지 않는다.** Chromium 131+ 는 summary 이외의 자식을 UA 의
//   `::details-content`(display:block) 안에 감싸므로 안쪽 `flex:1/min-height:0/overflow:auto`
//   스크롤러가 레이아웃에 참여하지 못한다(실측: 자식 3050px / 부모 clientH 300, 휠 무반응).
//   필드 펼침은 `div` + `button[aria-expanded]` + `hidden` 으로 만든다.
//   그리고 `hidden` 은 author `display` 선언에 특이도로 밀리므로 CSS 쪽에
//   `.edit-activity .edit-activity-fields[hidden]` (0,2,0) 규칙이 **반드시** 있어야 한다 —
//   같은 함정으로 상점 처리 편집창이 실제로 깨진 적이 있다(`!important` 는 예산 게이트 지표라 안 쓴다).
//
// 목록 스크롤은 `.map-history-list` 와 같은 `max-height` + `overflow:auto` 방식이다.
// `flex:1` 을 쓰지 않으므로 이 창을 `<details>` 안(작업 기록 탭)에 넣어도 위 함정에 걸리지 않는다.

import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { renderLegacyWikiActivityPanel } from "./legacyWikiActivityPanel";
import {
  describeEditActivity,
  EDIT_ACTIVITY_EVENT,
  editActivityEntryCount,
  getEditActivityEntries,
  serializeEditActivity,
  type EditActivityEntry,
  type EditActivityField,
  type EditActivityOrigin,
  type EditActivityQuery,
  type EditActivityScope,
} from "@/editor/editActivityLog";
import { downloadBlob } from "@/util/downloadBlob";
import { el } from "@/util/dom";
import { createLogger } from "@/util/logger";
import { toast } from "@/util/toast";

const log = createLogger("edit-activity-panel");

const SCOPE_LABELS: Record<EditActivityScope, string> = {
  map: "맵",
  database: "데이터베이스",
  system: "시스템",
  assets: "리소스",
  project: "프로젝트",
};

const ORIGIN_LABELS: Record<EditActivityOrigin, string> = {
  human: "사람",
  ai: "AI",
  tool: "도구",
  system: "시스템",
};

const SCOPE_ORDER: readonly EditActivityScope[] = ["map", "database", "system", "assets", "project"];

/** 한 번에 그리는 행 수. 500건 전량을 DOM 으로 펴면 드롭다운 열기가 눈에 띄게 늦다. */
const RENDER_LIMIT = 120;

/**
 * 살아 있는 구독 수. **테스트 seam** — 창이 DOM 에서 떨어졌을 때 window 리스너를
 * 정말로 뗐는지는 이 수치로만 밖에서 확인할 수 있다(리스너 목록을 조회하는 표준 API 가 없다).
 */
let subscriptionCount = 0;

export function editActivityPanelSubscriptionCount(): number {
  return subscriptionCount;
}

export function renderEditActivityPanel(): HTMLElement {
  const root = el("div", {
    class: "edit-activity",
    attrs: { "aria-label": "편집 행위 기록" },
    dataset: { testid: "edit-activity-panel" },
  });

  const scopeSelect = el("select", {
    class: "edit-activity-scope",
    attrs: { "aria-label": "범위 필터" },
    dataset: { testid: "edit-activity-scope" },
    children: [
      el("option", { text: "전체 범위", attrs: { value: "" } }),
      ...SCOPE_ORDER.map((scope) => el("option", { text: SCOPE_LABELS[scope], attrs: { value: scope } })),
    ],
  });

  const mapOnly = el("input", {
    class: "edit-activity-map-only-input",
    attrs: { type: "checkbox" },
    dataset: { testid: "edit-activity-map-only" },
  });

  const search = el("input", {
    class: "edit-activity-search",
    attrs: { type: "search", placeholder: "라벨·필드 검색", "aria-label": "기록 검색" },
    dataset: { testid: "edit-activity-search" },
  });

  const summary = el("div", {
    class: "edit-activity-summary",
    dataset: { testid: "edit-activity-summary" },
  });

  const list = el("ol", {
    class: "edit-activity-list",
    dataset: { testid: "edit-activity-list" },
  });

  const currentMapId = (): string | null => editorState.get().currentMapId ?? null;

  const query = (): EditActivityQuery => {
    const scope = scopeSelect.value;
    const mapId = mapOnly.checked ? currentMapId() : null;
    return {
      ...(scope === "" ? {} : { scope: scope as EditActivityScope }),
      ...(mapId === null ? {} : { mapId }),
    };
  };

  const term = (): string => search.value.trim().toLowerCase();

  /** 필터에 걸리는 것 **전부**. 내보내기가 여기에 붙는다. */
  const matchedEntries = (): readonly EditActivityEntry[] => {
    const rows = getEditActivityEntries(query());
    const needle = term();
    return needle === "" ? rows : rows.filter((entry) => haystack(entry).includes(needle));
  };

  /**
   * 내보내는 것은 **필터에 걸리는 전부**다 — 화면은 RENDER_LIMIT 으로 잘리지만, 사고 조사에서
   * 필요한 건 잘린 뒤쪽이다. 검색어는 `EditActivityQuery` 로 표현할 수 없어서 검색 중일 때만
   * 직접 직렬화하고, 그 밖에는 `serializeEditActivity(query)` 를 그대로 쓴다(같은 결과인데
   * 두 경로가 갈리면 "복사한 게 화면과 다르다" 는 의심을 살 여지가 생긴다).
   */
  const currentJson = (): string =>
    term() === "" ? serializeEditActivity(query()) : JSON.stringify(matchedEntries(), null, 2);

  const copyButton = el("button", {
    class: "edit-activity-action",
    text: "복사",
    attrs: { type: "button", title: "필터에 걸리는 기록 전체를 JSON 으로 클립보드에 복사" },
    dataset: { testid: "edit-activity-copy" },
    on: {
      click: () => {
        void copyText(currentJson()).then((ok) => {
          toast(ok ? "기록을 복사했습니다" : "복사에 실패했습니다", ok ? "ok" : "error");
        });
      },
    },
  });

  const exportButton = el("button", {
    class: "edit-activity-action",
    text: "내보내기",
    attrs: { type: "button", title: "필터에 걸리는 기록 전체를 JSON 파일로 저장" },
    dataset: { testid: "edit-activity-export" },
    on: {
      click: () => {
        try {
          downloadBlob(new Blob([currentJson()], { type: "application/json" }), exportFileName());
        } catch (error) {
          log.error("행위 기록 내보내기 실패", error);
          toast("내보내기에 실패했습니다", "error");
        }
      },
    },
  });

  const archive = el("div");
  let archivedWorld = store.getCurrent().world;
  archive.append(renderLegacyWikiActivityPanel(archivedWorld));
  const refresh = (): void => {
    const world = store.getCurrent().world;
    if (world !== archivedWorld) {
      archivedWorld = world;
      archive.replaceChildren(renderLegacyWikiActivityPanel(world));
    }
    const total = editActivityEntryCount();
    const matched = matchedEntries();
    const rows = matched.slice(0, RENDER_LIMIT);
    mapOnly.disabled = currentMapId() === null;
    summary.textContent = summaryText(total, matched.length, rows.length);
    list.replaceChildren(...(rows.length === 0 ? [emptyRow(total)] : rows.map((entry) => activityRow(entry))));
  };

  for (const control of [scopeSelect, mapOnly] as const) {
    control.addEventListener("change", refresh);
  }
  // search 는 change 만 보면 타이핑 중에 목록이 멈춘 것처럼 보인다 — input 으로 즉시 좁힌다.
  search.addEventListener("input", refresh);

  root.append(
    el("div", {
      class: "edit-activity-controls",
      children: [
        scopeSelect,
        el("label", {
          class: "edit-activity-map-only",
          attrs: { title: "현재 열려 있는 맵의 기록만 보기" },
          children: [mapOnly, el("span", { text: "이 맵만" })],
        }),
        search,
      ],
    }),
    el("div", { class: "edit-activity-toolbar", children: [summary, copyButton, exportButton] }),
    list, archive
  );

  refresh();
  installActivitySubscription(root, refresh);
  return root;
}

/**
 * `EDIT_ACTIVITY_EVENT` 구독 + **자동 해제**.
 *
 * 해제 시점을 호출부에 맡길 수 없다: 이 창은 도구막대 드롭다운(`makeHistoryDropdown`) 안에서
 * 재렌더마다 새로 만들어지고, 드롭다운은 닫힐 때 아무 알림도 주지 않는다. 그래서
 * "이벤트가 올 때 내 뿌리가 아직 문서에 붙어 있나" 를 스스로 확인해 떨어졌으면 뗀다.
 * (`mapHistoryPanel` 은 이 해제를 하지 않아 드롭다운을 열 때마다 리스너가 하나씩 쌓인다.)
 *
 * `attached` 플래그가 필요한 이유: 이 함수는 호출부가 append 하기 **전에** 돌기 때문에
 * 첫 이벤트에서 "붙은 적 없음" 과 "떨어짐" 을 구분하지 못하면 정상 창을 스스로 죽인다.
 */
function installActivitySubscription(root: HTMLElement, refresh: () => void): void {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
  let attached = false;
  let disposed = false;
  const handler = (): void => {
    if (disposed) return;
    if (isAttached(root)) attached = true;
    else if (attached) {
      disposed = true;
      subscriptionCount = Math.max(0, subscriptionCount - 1);
      window.removeEventListener(EDIT_ACTIVITY_EVENT, handler);
      unsubscribe();
      return;
    }
    refresh();
  };
  subscriptionCount += 1;
  const unsubscribe = store.subscribe(handler);
  window.addEventListener(EDIT_ACTIVITY_EVENT, handler);
}

function isAttached(node: HTMLElement): boolean {
  if (typeof node.isConnected === "boolean") return node.isConnected;
  // fakeDom 등 isConnected 가 없는 환경 폴백.
  return typeof document !== "undefined" && document.body.contains(node);
}

/**
 * 필터로 줄어든 것과 RENDER_LIMIT 으로 잘린 것을 갈라 말한다. 둘을 뭉쳐 "N건" 하나로 쓰면
 * 필터를 안 걸었는데도 수가 줄어든 것처럼 보여서 기록이 사라졌다고 오해한다.
 */
function summaryText(total: number, matched: number, shown: number): string {
  if (total === 0) return "기록 0건";
  const scope = matched === total ? `기록 ${total}건` : `${total}건 중 ${matched}건`;
  return shown < matched ? `${scope} · 최근 ${shown}건 표시` : scope;
}

/** 빈 상태는 "왜 비어 있나" 를 갈라 말해 준다 — 필터 때문인지, 정말 기록이 없는지. */
function emptyRow(total: number): HTMLElement {
  const text =
    total === 0
      ? "아직 기록된 편집 행위가 없습니다. 맵을 칠하거나 이벤트를 저장하면 여기에 쌓입니다."
      : `필터에 걸리는 기록이 없습니다. 범위·검색어를 지워 보세요. (전체 ${total}건)`;
  return el("li", { class: "edit-activity-empty", text, dataset: { testid: "edit-activity-empty" } });
}

function activityRow(entry: EditActivityEntry): HTMLElement {
  const children: HTMLElement[] = [
    el("div", {
      class: "edit-activity-head",
      children: [
        el("time", {
          class: "edit-activity-time",
          text: formatTime(entry.at),
          attrs: { datetime: entry.at, title: entry.at },
        }),
        el("span", { class: "edit-activity-desc", text: describeEditActivity(entry) }),
        el("span", {
          class: "edit-activity-origin",
          text: ORIGIN_LABELS[entry.origin] ?? entry.origin,
          dataset: { origin: entry.origin },
        }),
      ],
    }),
  ];
  if (entry.fields && entry.fields.length > 0) children.push(fieldsFold(entry.seq, entry.fields));
  return el("li", {
    class: `edit-activity-item${entry.label === null ? " is-unlabeled" : ""}`,
    dataset: { testid: `edit-activity-row-${entry.seq}` },
    children,
  });
}

function fieldsFold(seq: number, fields: readonly EditActivityField[]): HTMLElement {
  const body = el("div", {
    class: "edit-activity-fields",
    dataset: { testid: `edit-activity-fields-${seq}` },
    children: fields.map((field) => fieldRow(field)),
  });
  body.hidden = true;
  const toggle = el("button", {
    class: "edit-activity-fields-toggle",
    text: foldLabel(fields.length, false),
    attrs: { type: "button", "aria-expanded": "false" },
    dataset: { testid: `edit-activity-fields-toggle-${seq}` },
  });
  toggle.addEventListener("click", () => {
    const open = Boolean(body.hidden);
    body.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.textContent = foldLabel(fields.length, open);
  });
  return el("div", { class: "edit-activity-fold", children: [toggle, body] });
}

function foldLabel(count: number, open: boolean): string {
  return open ? `필드 ${count}개 접기` : `필드 ${count}개 보기`;
}

function fieldRow(field: EditActivityField): HTMLElement {
  return el("div", {
    class: "edit-activity-field",
    children: [
      el("code", { class: "edit-activity-field-path", text: field.path }),
      el("span", { class: "edit-activity-field-before", text: formatValue(field.before) }),
      el("span", { class: "edit-activity-field-arrow", text: "→", attrs: { "aria-hidden": "true" } }),
      el("span", { class: "edit-activity-field-after", text: formatValue(field.after) }),
    ],
  });
}

/** 값은 이미 `clipValue` 로 잘려서 들어온다 — 여기서는 사람이 읽는 표기만 맞춘다. */
function formatValue(value: unknown): string {
  if (value === undefined) return "(없음)";
  if (value === null) return "null";
  if (typeof value === "string") return value === "" ? "(빈 값)" : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return "(표시 불가)";
  }
}

function formatTime(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  const pad = (part: number): string => String(part).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 검색 대상. 화면에 보이는 한 줄 + 필드 경로/값까지 — 눈에 보이는 글자는 다 걸려야 한다. */
function haystack(entry: EditActivityEntry): string {
  const parts = [describeEditActivity(entry), entry.scope, ORIGIN_LABELS[entry.origin] ?? entry.origin];
  for (const field of entry.fields ?? []) {
    parts.push(field.path, formatValue(field.before), formatValue(field.after));
  }
  return parts.join(" ").toLowerCase();
}

function exportFileName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
  return `edit-activity-${stamp}.json`;
}

/**
 * 클립보드 복사. `regionTaskModal` 의 `copyTextToClipboard` 와 같은 계약이지만 그 모듈을
 * import 하지 않는다 — 작업 기록 드롭다운이 영역 작업 모달 전체를 번들에 끌어오게 된다.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    log.warn("클립보드 API 복사 실패 — textarea 폴백", error);
  }
  try {
    if (typeof document === "undefined") return false;
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.append(area);
    area.select?.();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch (error) {
    log.warn("textarea 폴백 복사 실패", error);
    return false;
  }
}

import { branchEmptyActionLabel, eventCommandBranches } from "@/editor/eventCommandBranches";
import type { Command } from "@/project/types";
import { el } from "@/util/dom";
import { commandCategoryVisual } from "./commandCategoryIcons";
import { renderEditorIcon, type EditorIconName } from "./editorIcons";
import { commandSummary } from "./commandSummary";
import { textBodyOf } from "@/project/io/rewriteLegacyDialogue";
import { commandKindLabel } from "./options";

export type StoryboardMode = "storyboard" | "list" | "preview" | "flow";

/** 저작 뷰(고치는 화면)만 다음 열기까지 저장한다. 나머지는 확인 뷰다. */
const AUTHORING_MODES: readonly StoryboardMode[] = ["list", "storyboard"];

const MODE_KEY = "oprn:storyboard-mode";

/**
 * 편집 세션 상태. 재렌더(스토어 변경 -> modal.ts 의 refresh)를 넘겨야 하는 값들이다.
 *
 * 왜 localStorage 로 부족한가: 미리보기는 저작 뷰가 아니라서 다음 열기까지 저장하지 않는다.
 * 그런데 초기 모드를 localStorage 에서만 읽으면, 명령을 하나 추가하는 순간 재렌더가
 * 저장된 저작 뷰로 되돌려 버린다 — 「미리보기에서 고치면 미리보기가 사라진다」.
 * 그래서 "지금 이 세션의 모드" 를 따로 들고, 저장은 저작 뷰만 한다.
 * 검색어도 같은 이유로 여기 있다 — 입력창은 매 렌더 새로 만들어지므로 값이 날아간다.
 */
let sessionMode: StoryboardMode | null = null;
let sessionQuery = "";
let sessionTarget: string | null = null;

export function loadStoryboardMode(): StoryboardMode {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    if (raw === "list" || raw === "storyboard") return raw;
  } catch { /* ignore */ }
  return "storyboard";
}

/** 미리보기·플로우는 저작 뷰가 아니라 확인 뷰라서 다음 열기까지 남기지 않는다. */
export function saveStoryboardMode(mode: StoryboardMode): void {
  if (!AUTHORING_MODES.includes(mode)) return;
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
}

/** 지금 이 편집 세션의 보기 방식. 렌더는 반드시 이것을 읽는다. */
export function currentStoryboardMode(): StoryboardMode {
  return sessionMode ?? loadStoryboardMode();
}

/** 보기 방식을 바꾼다. 저작 뷰만 다음 열기까지 저장된다. */
export function setStoryboardMode(mode: StoryboardMode): void {
  sessionMode = mode;
  saveStoryboardMode(mode);
}

/** 지금 이 세션의 명령 검색어. */
export function currentCommandQuery(): string {
  return sessionQuery;
}

export function setCommandQuery(query: string): void {
  sessionQuery = query;
}

/**
 * 이 대상(`맵:이벤트`)을 그리기 시작한다고 알린다.
 * 대상이 같으면 재렌더로 보고, 세션 상태를 그대로 둔다 — 그래서 미리보기 중에 명령을
 * 고쳐도 미리보기에 남는다. 다른 이벤트로 넘어가면 깨끗하게 시작한다.
 */
export function beginEventViewSession(target: string): void {
  if (sessionTarget === target) return;
  sessionTarget = target;
  sessionMode = null;
  sessionQuery = "";
}

/** 이벤트 에디터를 새로 열 때 호출한다 — 미리보기/검색어가 다음 세션으로 새지 않는다. */
export function resetEventViewSession(): void {
  sessionMode = null;
  sessionQuery = "";
  sessionTarget = null;
}

type CommandDigest = {
  readonly title: string;
  readonly detail: string;
  readonly category: string;
  readonly categoryLabel: string;
  readonly glyph: string;
  readonly icon: EditorIconName;
};

function summarizeCommand(cmd: Command): CommandDigest {
  // 카드 하나가 죽어도 이벤트 전체가 안 보이던 흰 화면으로 번지지 않게 — 요약은 절대 던지지 않는다.
  try {
    const compactSummary = (() => { try { return commandSummary(cmd); } catch { return cmd.kind; } })();
    const detail = cmd.kind === "text"
      ? `문장 표시: ${textBodyOf(cmd).replace(/\s+/g, " ").trim()}`
      : compactSummary;
    // 카테고리 시각 언어는 목록·피커와 같은 출처를 쓴다. 예전에는 여기에만 있던
    // 하드코딩 색표를 계산했는데 아무도 읽지 않는 죽은 값이었다.
    const visual = commandCategoryVisual(cmd);
    return {
      title: kindLabel(cmd.kind),
      detail,
      category: visual.key,
      categoryLabel: visual.label,
      glyph: visual.glyph,
      icon: visual.icon,
    };
  } catch (error) {
    console.error("[event-editor] failed to summarize command", cmd?.kind, error);
    return brokenCommandDigest(cmd);
  }
}

// 요약조차 못 뽑는 명령의 자리 표시자. 카드 위치를 지키고 원시값을 펼쳐 보여준다.
export function brokenCommandDigest(cmd: Command): CommandDigest {
  return {
    title: `표시할 수 없는 명령(${(cmd as { kind?: unknown })?.kind ?? "알 수 없음"})`,
    detail: rawCommandPreview(cmd),
    category: "flow",
    categoryLabel: "흐름",
    glyph: "!",
    icon: "warning",
  };
}

function rawCommandPreview(cmd: Command): string {
  try {
    const raw = JSON.stringify(cmd) ?? "";
    const oneLine = raw.replace(/\s+/g, " ").trim();
    return oneLine.length > 160 ? `${oneLine.slice(0, 157).trimEnd()}…` : oneLine;
  } catch {
    return "원시값을 읽지 못했습니다.";
  }
}

function kindLabel(kind: string): string {
  const m: Record<string, string> = {
    text: "대사", changeFace: "표정", choices: "선택지", fork: "분기", loop: "반복",
    transfer: "이동", moveEvent: "이벤트 이동", playBgm: "BGM", playSe: "SE",
    battleProcessing: "전투", shopProcessing: "상점", innProcessing: "여관",
    changeGold: "골드", changeItem: "아이템", wait: "대기",
  };
  return m[kind] ?? commandKindLabel(kind as Parameters<typeof commandKindLabel>[0]);
}

/** 빈 이벤트 진입 CTA — 작가가 가장 자주 시작하는 세 가지. */
export type StoryboardQuickStartKind = "text" | "transfer" | "shop";

const QUICK_START_ACTIONS: readonly {
  readonly kind: StoryboardQuickStartKind;
  readonly label: string;
  readonly hint: string;
}[] = [
  { kind: "text", label: "말하기", hint: "대사 창을 띄웁니다" },
  { kind: "transfer", label: "장소 옮기기", hint: "다른 맵으로 보냅니다" },
  { kind: "shop", label: "상점 열기", hint: "물건을 팝니다" },
];

export type StoryboardOptions = {
  /** 한 번 클릭 — 선택하고 오른쪽 「선택한 명령」 칼럼에 싣는다. */
  readonly onSelect?: (path: number[]) => void;
  /** 두 번 클릭 / Enter — 편집 창을 연다. */
  readonly onOpenEditor?: (path: number[]) => void;
  readonly onMove?: (path: number[], direction: -1 | 1) => void;
  readonly onDelete?: (path: number[]) => void;
  readonly onAddNext?: () => void;
  readonly onAddToBranch?: (containerPath: number[]) => void;
  readonly onQuickStart?: (kind: StoryboardQuickStartKind) => void;
  /** 재렌더 후 선택 복원용 경로. */
  readonly selectedPath?: readonly number[];
};

function samePath(a: readonly number[], b: readonly number[] | undefined): boolean {
  return !!b && a.length === b.length && a.every((value, index) => value === b[index]);
}

export function renderStoryboard(
  commands: readonly Command[],
  opts?: StoryboardOptions
): HTMLElement {
  const host = el("div", { class: "story event-storyboard", dataset: { testid: "event-storyboard" } });
  const markSelected = (control: HTMLElement): void => {
    for (const candidate of host.querySelectorAll<HTMLElement>("[data-cmd-path]")) {
      const isTarget = candidate === control;
      candidate.classList.toggle("selected", isTarget);
      candidate.classList.toggle("sel", isTarget);
      candidate.classList.toggle("is-selected", isTarget);
      if (isTarget) candidate.setAttribute("aria-current", "step");
      else candidate.removeAttribute("aria-current");
    }
  };
  const selectPath = (path: number[], control: HTMLElement): void => {
    markSelected(control);
    opts?.onSelect?.(path);
  };

  /**
   * 카드/분기 줄의 공통 상호작용. 목록 행과 **같은 계약**을 쓴다:
   * 한 번 = 선택(인스펙터), 두 번 = 편집 창, Enter/Space = 편집 창.
   * 예전에는 한 번 클릭이 곧바로 편집 모달을 열어서, 「선택한 명령」 칼럼이 스토리
   * 보기에서는 영원히 비어 있었고 툴바의 이동/복사도 대상을 못 찾았다.
   */
  const attachRowBehaviour = (row: HTMLElement, path: number[]): void => {
    row.addEventListener("click", (event) => {
      const target = event.target as { closest?: (selector: string) => unknown } | null;
      if (target?.closest?.(".event-storyboard-row-actions")) return;
      selectPath(path, row);
    });
    row.addEventListener("dblclick", (event) => {
      const target = event.target as { closest?: (selector: string) => unknown } | null;
      if (target?.closest?.(".event-storyboard-row-actions")) return;
      event.preventDefault();
      event.stopPropagation();
      selectPath(path, row);
      opts?.onOpenEditor?.(path);
    });
    row.addEventListener("keydown", (event) => {
      // fakeDom 에는 KeyboardEvent 생성자가 없을 수 있다 — duck-type 으로 받는다.
      const key = (event as KeyboardEvent).key;
      if (key !== "Enter" && key !== " " && key !== "Spacebar") return;
      event.preventDefault();
      selectPath(path, row);
      opts?.onOpenEditor?.(path);
    });
  };

  /** 줄 오른쪽 액션. 목록 행의 `.cmd-actions` 와 같은 세트다. */
  const rowActions = (path: number[]): HTMLElement | null => {
    const buttons: HTMLElement[] = [];
    const stop = (run: () => void) => (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      run();
    };
    if (opts?.onMove) {
      buttons.push(el("button", {
        class: "event-storyboard-row-action",
        children: [renderEditorIcon("arrowUp")],
        attrs: { type: "button", title: "위로 이동", "aria-label": "위로 이동" },
        dataset: { testid: `event-storyboard-move-up-${path.join("-")}` },
        on: { click: stop(() => opts.onMove!(path, -1)) },
      }));
      buttons.push(el("button", {
        class: "event-storyboard-row-action",
        children: [renderEditorIcon("arrowDown")],
        attrs: { type: "button", title: "아래로 이동", "aria-label": "아래로 이동" },
        dataset: { testid: `event-storyboard-move-down-${path.join("-")}` },
        on: { click: stop(() => opts.onMove!(path, 1)) },
      }));
    }
    if (opts?.onOpenEditor) {
      buttons.push(el("button", {
        class: "event-storyboard-row-action",
        children: [renderEditorIcon("pencil")],
        attrs: { type: "button", title: "고치기", "aria-label": "고치기" },
        dataset: { testid: `event-storyboard-edit-${path.join("-")}` },
        on: { click: stop(() => opts.onOpenEditor!(path)) },
      }));
    }
    if (opts?.onDelete) {
      buttons.push(el("button", {
        class: "event-storyboard-row-action is-danger",
        children: [renderEditorIcon("trash")],
        attrs: { type: "button", title: "삭제", "aria-label": "삭제" },
        dataset: { testid: `event-storyboard-delete-${path.join("-")}` },
        on: { click: stop(() => opts.onDelete!(path)) },
      }));
    }
    if (buttons.length === 0) return null;
    return el("div", {
      class: "event-storyboard-row-actions",
      attrs: { role: "group", "aria-label": "이 명령 다루기" },
      children: buttons,
    });
  };

  // 분기 안 명령 하나가 터져도 형제·부모 카드는 살아남는다. 실패한 잎만 자리 표시자로 그린다.
  const renderBrokenLeaf = (command: Command, path: number[]): HTMLElement => {
    const info = brokenCommandDigest(command);
    const leaf = el("div", {
      class: "leaf event-storyboard-branch-command is-broken",
      attrs: {
        role: "button",
        tabindex: "0",
        title: "이 명령은 표시할 수 없어 원시값으로 보여줍니다",
        "aria-label": `표시할 수 없는 명령: ${info.detail}`,
      },
      dataset: { testid: `event-storyboard-broken-${path.join("-")}`, cmdPath: JSON.stringify(path), commandCategory: info.category },
      children: [
        el("span", { class: "kind", text: info.title }),
        el("span", { class: "line", text: info.detail }),
        ...(opts?.onDelete ? [el("button", {
          class: "event-storyboard-row-action is-danger",
          text: "삭제",
          attrs: { type: "button", "aria-label": "표시할 수 없는 명령 삭제" },
          dataset: { testid: `event-storyboard-broken-delete-${path.join("-")}` },
          on: { click: (event: Event) => { event.stopPropagation(); opts.onDelete!(path); } },
        })] : []),
      ],
    });
    attachRowBehaviour(leaf, path);
    return el("div", {
      class: "event-storyboard-branch-command-tree",
      children: [leaf],
    });
  };
  // 명령이 있는 분기의 끝에도 넣을 자리를 남긴다(명령 목록 보기의 cmd-branch-add 와 같은 이유).
  const renderBranchAddButton = (containerPath: number[]): HTMLElement =>
    el("button", {
      class: "event-storyboard-branch-empty event-storyboard-branch-add",
      text: "+ 이 분기에 명령 추가",
      attrs: { type: "button", title: "이 분기의 마지막에 명령을 하나 넣어줍니다" },
      dataset: { testid: `event-storyboard-branch-add-${containerPath.join("-")}` },
      on: { click: () => opts?.onAddToBranch?.(containerPath) },
    });
  const renderBranchCommands = (branchCommands: readonly Command[], pathPrefix: number[]): HTMLElement[] =>
    branchCommands.map((command, commandIndex) => {
      const path = [...pathPrefix, commandIndex];
      try {
        return renderBranchLeaf(command, path);
      } catch (error) {
        console.error("[event-editor] failed to render branch command", path, error);
        return renderBrokenLeaf(command, path);
      }
    });
  const renderBranchLeaf = (command: Command, path: number[]): HTMLElement => {
    const commandIndex = path[path.length - 1] ?? 0;
    const info = summarizeCommand(command);
    const descendants = branchesOf(command);
    const actions = rowActions(path);
    const leaf = el("div", {
      class: "leaf event-storyboard-branch-command",
        attrs: {
          role: "button",
          tabindex: "0",
          title: "한 번 클릭하면 선택, 두 번 클릭하면 편집",
          "aria-label": `${commandIndex + 1}번째 명령, ${info.title}: ${info.detail}`,
        },
        dataset: { cmdPath: JSON.stringify(path), commandCategory: info.category },
        children: [
          el("span", {
            class: "event-storyboard-branch-step",
            text: String(commandIndex + 1),
            attrs: { "aria-hidden": "true" },
          }),
          el("span", { class: "kind", text: info.title }),
          el("span", { class: "line", text: info.detail }),
        ...(actions ? [actions] : []),
      ],
    });
    attachRowBehaviour(leaf, path);
    if (samePath(path, opts?.selectedPath)) {
      leaf.classList.add("selected", "sel", "is-selected");
      leaf.setAttribute("aria-current", "step");
    }
    return el("div", {
      class: "event-storyboard-branch-command-tree",
      children: [
        leaf,
        ...(descendants.length > 0
          ? [el("div", {
              class: "branch event-storyboard-branch-descendants",
              children: descendants.map((branch) => el("section", {
                class: "event-storyboard-branch-panel",
                children: [
                  el("div", { class: "branch-h event-storyboard-branch-label", text: branch.label || "이름 없는 분기" }),
                  ...(branch.commands.length > 0
                    ? [
                        ...renderBranchCommands(branch.commands, [...path, branch.pathSegment]),
                        renderBranchAddButton([...path, branch.pathSegment]),
                      ]
                    : [el("button", {
                        class: "event-storyboard-branch-empty",
                        text: branchEmptyActionLabel,
                        attrs: { type: "button", title: "이 분기에 명령을 하나 넣어줍니다" },
                        dataset: { testid: `event-storyboard-branch-empty-${[...path, branch.pathSegment].join("-")}` },
                        on: { click: () => opts?.onAddToBranch?.([...path, branch.pathSegment]) },
                      })]),
                ],
              })),
            })]
          : []),
      ],
    });
  };

  if (commands.length === 0) {
    host.append(el("div", {
      class: "event-storyboard-empty",
      dataset: { testid: "event-storyboard-empty" },
      children: [
        el("strong", { text: "무엇부터 할까요?" }),
        el("span", { text: "가장 자주 쓰는 시작을 고르세요. 전체 명령은 아래 [첫 명령 추가]에 있습니다." }),
        el("div", {
          class: "event-storyboard-quick-starts",
          dataset: { testid: "event-storyboard-quick-starts" },
          children: QUICK_START_ACTIONS.map((action) => el("button", {
            class: `event-storyboard-quick-start is-${action.kind}`,
            attrs: { type: "button", "aria-label": `${action.label} — ${action.hint}` },
            dataset: { testid: `event-storyboard-quick-${action.kind}` },
            on: { click: () => opts?.onQuickStart?.(action.kind) },
            children: [
              el("span", { class: "event-storyboard-quick-start-label", text: action.label }),
              el("span", { class: "event-storyboard-quick-start-hint", text: action.hint }),
            ],
          })),
        }),
      ],
    }));
  } else {
    commands.forEach((cmd, idx) => {
      // 카드 하나가 터져도 형제는 살아남는다. 카드 본문도 try 안에 넣는다.
      try {
        for (const node of renderTopCard(cmd, idx)) host.append(node);
      } catch (error) {
        console.error("[event-editor] failed to render storyboard card", [idx], error);
        host.append(renderBrokenCard(cmd, idx));
      }
    });
  }

  function renderTopCard(cmd: Command, idx: number): HTMLElement[] {
    const info = summarizeCommand(cmd);
    // 분기 이름은 바로 아래 `branchPanels` 가 전부 펼쳐 보여준다. 예전에는 카드 안에도
    // 앞 2개만 12자로 자른 «칩 줄» 을 같이 찍어, 같은 목록이 40px 간격으로 두 번 나왔다
    // (분기가 1개인 반복 명령은 «반복할 내용» 이 연달아 두 번). 열등한 사본이라 지웠다.
    const branches = branchesOf(cmd);
    const actions = rowActions([idx]);
    const row = el("div", {
      class: "row event-storyboard-card",
      attrs: {
        role: "button",
        tabindex: "0",
        title: "한 번 클릭하면 선택, 두 번 클릭하면 편집",
        "aria-label": `${idx + 1}번째 명령, ${info.title}: ${info.detail}`,
      },
      dataset: {
        testid: `event-storyboard-card-${idx}`,
        cmdPath: JSON.stringify([idx]),
        commandCategory: info.category,
      },
      children: [
        el("span", { class: "n event-storyboard-card-thumb", text: String(idx + 1) }),
        el("span", {
          class: "event-storyboard-card-cat",
          attrs: { "aria-hidden": "true", title: `${info.categoryLabel} 명령` },
          dataset: { glyph: info.glyph, label: info.categoryLabel },
          children: [renderEditorIcon(info.icon)],
        }),
        el("span", { class: "kind event-storyboard-card-title", text: info.title }),
        el("span", { class: "line event-storyboard-card-detail", text: info.detail }),
        ...(actions ? [actions] : []),
      ],
    });
    attachRowBehaviour(row, [idx]);
    if (samePath([idx], opts?.selectedPath)) {
      row.classList.add("selected", "sel", "is-selected");
      row.setAttribute("aria-current", "step");
    }
    const branchPanels = branches.length > 0
      ? el("div", {
          class: "branch event-storyboard-branches",
          children: branches.flatMap((branch) => [
            el("div", {
              class: "branch-h event-storyboard-branch-label",
              text: branch.label || "이름 없는 분기",
            }),
            ...(branch.commands.length > 0
              ? [
                  ...renderBranchCommands(branch.commands, [idx, branch.pathSegment]),
                  renderBranchAddButton([idx, branch.pathSegment]),
                ]
              : [el("button", {
                  class: "event-storyboard-branch-empty",
                  text: branchEmptyActionLabel,
                  attrs: { type: "button", title: "이 분기에 명령을 하나 넣어줍니다" },
                  dataset: { testid: `event-storyboard-branch-empty-${idx}-${branch.pathSegment}` },
                  on: { click: () => opts?.onAddToBranch?.([idx, branch.pathSegment]) },
                })]),
          ]),
        })
      : null;
    return branchPanels ? [row, branchPanels] : [row];
  }
  function renderBrokenCard(cmd: Command, idx: number): HTMLElement {
    const info = brokenCommandDigest(cmd);
    return el("div", {
      class: "row event-storyboard-card is-broken",
      attrs: {
        role: "button",
        tabindex: "0",
        title: "이 명령은 표시할 수 없어 원시값으로 보여줍니다",
        "aria-label": `${idx + 1}번째 명령, ${info.title}: ${info.detail}`,
      },
      dataset: {
        testid: `event-storyboard-broken-${idx}`,
        cmdPath: JSON.stringify([idx]),
        commandCategory: info.category,
      },
      children: [
        el("span", { class: "n event-storyboard-card-thumb", text: String(idx + 1) }),
        el("span", { class: "kind event-storyboard-card-title", text: info.title }),
        el("span", { class: "line event-storyboard-card-detail", text: info.detail }),
        ...(opts?.onDelete ? [el("button", {
          class: "event-storyboard-row-action is-danger",
          text: "삭제",
          attrs: { type: "button", "aria-label": "표시할 수 없는 명령 삭제" },
          dataset: { testid: `event-storyboard-broken-delete-${idx}` },
          on: { click: (event: Event) => { event.stopPropagation(); opts.onDelete!([idx]); } },
        })] : []),
      ],
    });
  }

  const addCard = el("button", {
    class: "add-next event-storyboard-add",
    attrs: { type: "button", "aria-label": commands.length === 0 ? "첫 명령 추가" : "다음 명령 추가" },
    dataset: { testid: "event-storyboard-add" },
    on: { click: () => opts?.onAddNext?.() },
    children: [
      el("span", { text: commands.length === 0 ? "+ 첫 명령 추가" : "+ 다음 명령" }),
    ],
  });
  host.append(addCard);
  return host;
}

type StoryboardBranch = {
  label: string;
  commands: readonly Command[];
  pathSegment: number;
};

/**
 * 분기 열거는 `@/editor/eventCommandBranches` 가 정본이다. 여기는 경로 칸 이름만 바꿔주는
 * 얇은 어댑터라 목록을 따로 들지 않는다.
 */
function branchesOf(cmd: Command): StoryboardBranch[] {
  return eventCommandBranches(cmd).map((branch) => ({
    label: branch.label,
    commands: branch.commands,
    pathSegment: branch.branchIndex,
  }));
}

export function renderViewToggle(
  current: StoryboardMode,
  onChange: (next: StoryboardMode) => void
): HTMLElement {
  // 플로우는 예전에 도구 팝오버 안 280px 오버레이였다 — 미리보기 위에 겹쳐 뜨면서
  // 「자동 재생」과 단계 카운터를 덮었다. 이제 네 번째 보기 방식이라 겹치지 않는다.
  const modes: readonly StoryboardMode[] = ["list", "storyboard", "preview", "flow"];
  const labels: Record<StoryboardMode, string> = { list: "목록", storyboard: "스토리", preview: "미리보기", flow: "플로우" };
  const hints: Record<StoryboardMode, string> = {
    list: "명령을 한 줄씩 보고 고칩니다",
    storyboard: "이야기 흐름으로 훑어봅니다",
    preview: "차례대로 실행되는 모습을 봅니다",
    flow: "분기가 어떻게 갈라지는지 봅니다",
  };
  // 「여럿 중 하나」는 tablist 다 — 독립 토글 넷이 아니다.
  //
  // 예전엔 `role="group"` + 버튼마다 `aria-pressed` 였다. aria-pressed 는 각자 눌리고 풀리는
  // 토글 버튼의 속성이라, 보조기술에는 «네 개를 동시에 켤 수도 있는 스위치 묶음»으로 읽혔다.
  // 바로 옆 페이지 탭 줄은 같은 모달 안에서 이미 tablist + aria-selected 로 맞춰져 있고
  // (`pageProps.ts`), 거기엔 aria-pressed 를 섞지 말라는 주석까지 있다. 규칙을 아는
  // 코드베이스가 이 컨트롤에서만 어기고 있었다.
  //
  // 로빙 tabindex 도 같이 맞춘다. 넷 다 tabindex 기본값이라 보기 세그먼트 하나가 Tab 정지를
  // 4개 먹었다(페이지 탭 줄은 1개). 상태 클래스도 `on` 과 `is-active` 두 개를 같이 달아
  // 두 CSS 세대를 동시에 먹이고 있었는데, 이제 상태의 출처는 `aria-selected` 하나다.
  const bar = el("div", {
    class: "seg event-view-toggle",
    attrs: { role: "tablist", "aria-label": "보기 방식" },
    dataset: { testid: "event-view-toggle" },
  });
  const buttons: HTMLElement[] = [];
  const focusMode = (index: number): void => {
    const next = buttons[((index % modes.length) + modes.length) % modes.length];
    next?.focus();
    next?.click();
  };
  modes.forEach((mode, index) => {
    const selected = mode === current;
    const btn = el("button", {
      class: "event-view-toggle-btn",
      text: labels[mode],
      attrs: {
        type: "button",
        role: "tab",
        title: hints[mode],
        "aria-selected": selected ? "true" : "false",
        tabindex: selected ? "0" : "-1",
      },
      dataset: { testid: `event-view-toggle-${mode}` },
      on: {
        click: () => { if (mode !== current) { setStoryboardMode(mode); onChange(mode); } },
        keydown: (event: Event) => {
          if (!(event instanceof KeyboardEvent)) return;
          switch (event.key) {
            case "ArrowLeft": event.preventDefault(); focusMode(index - 1); return;
            case "ArrowRight": event.preventDefault(); focusMode(index + 1); return;
            case "Home": event.preventDefault(); focusMode(0); return;
            case "End": event.preventDefault(); focusMode(modes.length - 1); return;
            default: return;
          }
        },
      },
    });
    buttons.push(btn);
    bar.append(btn);
  });
  return bar;
}

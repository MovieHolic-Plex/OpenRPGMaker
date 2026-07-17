import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import type { Layer } from "@/editor/editorState";
import { store } from "@/project/store";
import type {
  Command,
  EventPage,
  EventPageCondition,
  GameEvent,
  Trigger,
} from "@/project/types";

type EventMarkerLayer = "lower" | "upper" | "event";

const MAP_MAX_COMMAND_LINES = 4;
const MAP_MAX_COMMAND_CHARS = 48;
const LIST_MAX_PAGES = 4;
const LIST_MAX_COMMAND_LINES = 8;
const LIST_MAX_COMMAND_CHARS = 72;
const LIST_MAX_CONDITIONS = 4;

const TRIGGER_LABELS: Readonly<Record<Trigger["kind"], string>> = {
  action: "결정키로 시작",
  touch: "플레이어가 접촉",
  playerTouch: "플레이어가 접촉",
  eventTouch: "이벤트가 접촉",
  auto: "자동 실행",
  parallel: "병렬 처리",
};

const PRIORITY_LABELS: Readonly<Record<EventPage["priority"], string>> = {
  below: "캐릭터 아래",
  same: "캐릭터와 같음",
  above: "캐릭터 위",
};

export type EventMarkerTooltipModel = {
  readonly title: string;
  readonly meta: string;
  readonly commands: readonly string[];
  readonly moreCommandCount: number;
  readonly plainText: string;
};

export type EventListTooltipPageModel = {
  readonly label: string;
  readonly trigger: string;
  readonly priority: string;
  readonly conditions: readonly string[];
  readonly commands: readonly string[];
  readonly moreCommandCount: number;
};

export type EventListTooltipModel = {
  readonly title: string;
  readonly identity: string;
  readonly location: string;
  readonly characterId: string | null;
  readonly pages: readonly EventListTooltipPageModel[];
  readonly morePageCount: number;
  readonly plainText: string;
};

export function eventDisplayName(event: Pick<GameEvent, "id" | "pages">): string {
  const pages = event.pages ?? [];
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const name = pages[index]?.name.trim();
    if (name) return name;
  }
  return event.id;
}

/** 맵 위 이벤트 호버 요약. 이름·트리거·실행 명령 몇 줄을 plain text로 반환. */
export function eventMarkerTooltip(
  event: Pick<GameEvent, "id" | "pages" | "x" | "y" | "trigger" | "commands">,
): string {
  return buildEventMarkerTooltipModel(event).plainText;
}

export function buildEventMarkerTooltipModel(
  event: Pick<GameEvent, "id" | "pages" | "x" | "y" | "trigger" | "commands">,
): EventMarkerTooltipModel {
  const page = primaryEventPage(event);
  const title = eventDisplayName(event);
  const trigger = page?.trigger ?? event.trigger;
  const pageCount = event.pages?.length ?? 0;
  const metaParts = [
    `(${event.x},${event.y})`,
    triggerLabel(trigger),
    pageCount > 1 ? `${pageCount}페이지` : pageCount === 1 ? "1페이지" : null,
  ].filter((part): part is string => Boolean(part));
  const meta = metaParts.join(" · ");

  const commands = page?.commands ?? event.commands ?? [];
  const summaries = summarizeEventCommands(commands, MAP_MAX_COMMAND_LINES, MAP_MAX_COMMAND_CHARS);
  const lines = [
    title,
    meta,
    ...summaries.lines.map((line) => `• ${line}`),
    ...(summaries.moreCount > 0 ? [`(+${summaries.moreCount}개 명령 더)`] : []),
  ];

  return {
    title,
    meta,
    commands: summaries.lines,
    moreCommandCount: summaries.moreCount,
    plainText: lines.join("\n"),
  };
}

/** 왼쪽 맵 이벤트 목록 호버 — 페이지/조건/명령까지 더 자세히. */
export function buildEventListTooltipModel(event: GameEvent): EventListTooltipModel {
  const title = eventDisplayName(event);
  const pages = event.pages ?? [];
  const characterId = event.characterId?.trim() || null;
  const pageModels: EventListTooltipPageModel[] = [];

  for (let index = 0; index < pages.length && pageModels.length < LIST_MAX_PAGES; index += 1) {
    const page = pages[index];
    if (!page) continue;
    pageModels.push(buildListPageModel(page, index));
  }

  // pages가 비어 있으면 레거시 root commands를 한 블록으로 보여 준다.
  if (pageModels.length === 0) {
    const commands = event.commands ?? [];
    const summaries = summarizeEventCommands(commands, LIST_MAX_COMMAND_LINES, LIST_MAX_COMMAND_CHARS);
    pageModels.push({
      label: "페이지 1",
      trigger: triggerLabel(event.trigger),
      priority: "—",
      conditions: ["조건 없음"],
      commands: summaries.lines,
      moreCommandCount: summaries.moreCount,
    });
  }

  const morePageCount = Math.max(0, pages.length - pageModels.length);
  const plainLines = [
    title,
    `ID ${event.id} · (${event.x},${event.y}) · ${pages.length || 1}페이지`,
    ...(characterId ? [`캐릭터 ID: ${characterId}`] : []),
  ];
  for (const page of pageModels) {
    plainLines.push("");
    plainLines.push(page.label);
    plainLines.push(`${page.trigger} · ${page.priority}`);
    plainLines.push(`조건: ${page.conditions.join(" / ")}`);
    if (page.commands.length === 0) {
      plainLines.push("• 실행 명령 없음");
    } else {
      for (const command of page.commands) plainLines.push(`• ${command}`);
      if (page.moreCommandCount > 0) plainLines.push(`(+${page.moreCommandCount}개 명령 더)`);
    }
  }
  if (morePageCount > 0) plainLines.push(`(+${morePageCount}페이지 더)`);

  return {
    title,
    identity: event.id,
    location: `(${event.x},${event.y}) · ${pages.length || 1}페이지`,
    characterId,
    pages: pageModels,
    morePageCount,
    plainText: plainLines.join("\n"),
  };
}

export function renderEventMarkerTooltipElement(model: EventMarkerTooltipModel): HTMLElement {
  const root = document.createElement("div");
  root.className = "event-marker-tooltip";
  root.dataset.testid = "event-marker-tooltip";
  root.setAttribute("role", "tooltip");

  const title = document.createElement("div");
  title.className = "event-marker-tooltip-title";
  title.textContent = model.title;
  root.append(title);

  const meta = document.createElement("div");
  meta.className = "event-marker-tooltip-meta";
  meta.textContent = model.meta;
  root.append(meta);

  if (model.commands.length > 0) {
    const list = document.createElement("ul");
    list.className = "event-marker-tooltip-commands";
    for (const line of model.commands) {
      const item = document.createElement("li");
      item.textContent = line;
      list.append(item);
    }
    root.append(list);
  } else {
    const empty = document.createElement("div");
    empty.className = "event-marker-tooltip-empty";
    empty.textContent = "실행 명령 없음";
    root.append(empty);
  }

  if (model.moreCommandCount > 0) {
    const more = document.createElement("div");
    more.className = "event-marker-tooltip-more";
    more.textContent = `+${model.moreCommandCount}개 명령 더`;
    root.append(more);
  }

  return root;
}

export function renderEventListTooltipElement(model: EventListTooltipModel): HTMLElement {
  const root = document.createElement("div");
  root.className = "event-marker-tooltip event-list-tooltip";
  root.dataset.testid = "event-list-tooltip";
  root.setAttribute("role", "tooltip");

  const title = document.createElement("div");
  title.className = "event-marker-tooltip-title";
  title.textContent = model.title;
  root.append(title);

  const meta = document.createElement("div");
  meta.className = "event-marker-tooltip-meta";
  meta.textContent = `ID ${model.identity} · ${model.location}`;
  root.append(meta);

  if (model.characterId) {
    const character = document.createElement("div");
    character.className = "event-list-tooltip-character";
    character.textContent = `캐릭터 ID: ${model.characterId}`;
    root.append(character);
  }

  for (const page of model.pages) {
    const block = document.createElement("section");
    block.className = "event-list-tooltip-page";

    const heading = document.createElement("div");
    heading.className = "event-list-tooltip-page-title";
    heading.textContent = page.label;
    block.append(heading);

    const pageMeta = document.createElement("div");
    pageMeta.className = "event-list-tooltip-page-meta";
    pageMeta.textContent = `${page.trigger} · ${page.priority}`;
    block.append(pageMeta);

    const conditions = document.createElement("div");
    conditions.className = "event-list-tooltip-conditions";
    conditions.textContent = `조건: ${page.conditions.join(" / ")}`;
    block.append(conditions);

    if (page.commands.length > 0) {
      const list = document.createElement("ul");
      list.className = "event-marker-tooltip-commands";
      for (const line of page.commands) {
        const item = document.createElement("li");
        item.textContent = line;
        list.append(item);
      }
      block.append(list);
    } else {
      const empty = document.createElement("div");
      empty.className = "event-marker-tooltip-empty";
      empty.textContent = "실행 명령 없음";
      block.append(empty);
    }

    if (page.moreCommandCount > 0) {
      const more = document.createElement("div");
      more.className = "event-marker-tooltip-more";
      more.textContent = `+${page.moreCommandCount}개 명령 더`;
      block.append(more);
    }

    root.append(block);
  }

  if (model.morePageCount > 0) {
    const morePages = document.createElement("div");
    morePages.className = "event-marker-tooltip-more";
    morePages.textContent = `+${model.morePageCount}페이지 더`;
    root.append(morePages);
  }

  return root;
}

export function shouldOfferEventLayerSwitch(input: {
  readonly activeLayer: EventMarkerLayer | Layer;
  readonly clickCount: number;
  readonly hasEvent: boolean;
}): boolean {
  return input.activeLayer !== "event" && input.clickCount >= 2 && input.hasEvent;
}

/** 더블클릭은 편집 의도가 명확하므로 확인 모달 없이 바로 전환하고, 무슨 일이 있었는지 토스트로 알린다. */
export function eventLayerSwitchNotice(event: Pick<GameEvent, "id" | "pages">): string {
  return `'${eventDisplayName(event)}' 이벤트를 엽니다 — 이벤트 레이어로 전환했습니다.`;
}

function buildListPageModel(page: EventPage, index: number): EventListTooltipPageModel {
  const pageName = page.name.trim();
  const label = pageName ? `페이지 ${index + 1} — ${pageName}` : `페이지 ${index + 1}`;
  const conditions = page.conditions ?? [];
  const conditionLines =
    conditions.length === 0
      ? ["조건 없음"]
      : conditions.slice(0, LIST_MAX_CONDITIONS).map(pageConditionSummary);
  if (conditions.length > LIST_MAX_CONDITIONS) {
    conditionLines.push(`(+${conditions.length - LIST_MAX_CONDITIONS}개 조건 더)`);
  }
  const summaries = summarizeEventCommands(
    page.commands ?? [],
    LIST_MAX_COMMAND_LINES,
    LIST_MAX_COMMAND_CHARS,
  );
  return {
    label,
    trigger: triggerLabel(page.trigger),
    priority: PRIORITY_LABELS[page.priority] ?? page.priority,
    conditions: conditionLines,
    commands: summaries.lines,
    moreCommandCount: summaries.moreCount,
  };
}

function primaryEventPage(event: Pick<GameEvent, "pages">): EventPage | undefined {
  const pages = event.pages ?? [];
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const page = pages[index];
    if (page?.name.trim()) return page;
  }
  return pages[0];
}

function triggerLabel(trigger: Trigger | undefined): string {
  if (!trigger) return "트리거 없음";
  return TRIGGER_LABELS[trigger.kind] ?? trigger.kind;
}

function summarizeEventCommands(
  commands: readonly Command[],
  maxLines: number,
  maxChars: number,
): {
  readonly lines: readonly string[];
  readonly moreCount: number;
} {
  if (commands.length === 0) return { lines: [], moreCount: 0 };
  const lines: string[] = [];
  for (const command of commands) {
    if (lines.length >= maxLines) break;
    const summary = truncateSummary(commandSummary(command), maxChars);
    if (summary) lines.push(summary);
  }
  const moreCount = Math.max(0, commands.length - lines.length);
  return { lines, moreCount };
}

function truncateSummary(text: string, maxChars: number): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, maxChars - 1)}…`;
}

function pageConditionSummary(condition: EventPageCondition): string {
  switch (condition.kind) {
    case "switch":
      return `스위치 [${switchVariableName("switch", condition.switchId)}] ${condition.value ? "ON" : "OFF"}`;
    case "variable":
      return `변수 [${switchVariableName("variable", condition.variableId)}] ${condition.op} ${condition.value}`;
    case "selfSwitch":
      return `셀프 스위치 ${condition.key} ${condition.value ? "ON" : "OFF"}`;
    case "actor":
      return `주인공 [${recordName(store.getCurrent().database.actors, condition.actorId)}] ${condition.present ? "파티에 있음" : "파티에 없음"}`;
    case "item":
      return `아이템 [${recordName(store.getCurrent().database.items, condition.itemId)}] ${condition.present ? "보유 중" : "미보유"}`;
    case "gold":
      return `소지금 ${condition.op} ${condition.amount}`;
    case "timer":
      return `${condition.timerId === "timer1" ? "타이머 1" : "타이머 2"} ${condition.seconds}초 이하`;
    case "timePhase":
      return `시간대 ${timePhaseLabel(condition.phase)}`;
    case "season":
      return `계절 ${seasonLabel(condition.season)}`;
    case "npcActivity":
      return `활동 ${condition.activity}`;
    case "friendshipAtLeast":
      return `호감도 ${condition.npcKey || "이 이벤트"} >= ${condition.value}`;
  }
}

function switchVariableName(kind: "switch" | "variable", id: string): string {
  const project = store.getCurrent();
  const records = kind === "switch" ? project.switches : project.variables;
  const match = Array.isArray(records) ? records.find((entry) => entry.id === id) : undefined;
  return match?.name?.trim() || id;
}

function recordName(records: readonly { readonly id: string; readonly name: string }[], id: string): string {
  return records.find((entry) => entry.id === id)?.name?.trim() || id;
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
    case "autumn":
      return "가을";
    case "winter":
      return "겨울";
  }
}

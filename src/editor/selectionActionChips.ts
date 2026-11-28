// 선택 영역 액션 바 (안 B — 초미니멀 4버튼 원형 + 펼침형).
// 우클릭 드래그 직후에는 캔버스 가림을 최소화하는 1줄 컴팩트 HUD만 띄운다:
//   [1 · 최우선] [2 · 2순위] [3 · 3순위] [4 · ✦ 조수 지시] | [📍 구역 태그] [··· 더보기] [✕]
// 초기 상태는 입력창이 접혀 있어 드래그 직후 Ctrl+C / Ctrl+V / Del / Esc 캔버스 단축키가 그대로 통한다.
// 1(NPC)·2(맵 디렉팅)·4(조수 지시)·📍(구역 태그)를 누를 때만 해당 서랍이 아래로 펼쳐진다.
import { requestAiRegionHandoff } from "@/editor/aiRegionHandoff";
import { isStampPlaceOn, setStampPlaceOn, subscribeStampPlace } from "@/editor/stampPlaceMode";
import { saveSelectionAsStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import type { TileSelection } from "@/editor/editorState";
import { editorState } from "@/editor/editorState";
import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import { toast } from "@/util/toast";
import {
  cancelPastePreview,
  clearSelection,
  clearSelectionRegion,
  copySelection,
  enterPastePreview,
} from "@/editor/mapClipboard";
import { POLISH_INSTRUCTION } from "@/editor/regionTask/suggestedCommands";
import { planSelectionVillage } from "@/editor/selectionVillage";
import {
  analyzeSelectionIntent,
  type SelectionIntentAnalysis,
  type SelectionQuickAction,
} from "@/editor/selectionIntentRank";
import {
  NPC_ARCHETYPES,
  NPC_ARCHETYPE_CATEGORIES,
  buildNpcArchetypePrompt,
  getNpcArchetype,
  recommendedNpcArchetypes,
  type NpcArchetypeCategory,
  type NpcArchetypeId,
} from "@/editor/selectionNpcArchetypes";
import {
  DIRECT_ARCHETYPES,
  DIRECT_ARCHETYPE_CATEGORIES,
  buildDirectArchetypePrompt,
  getDirectArchetype,
  recommendedDirectArchetypes,
  type DirectArchetypeCategory,
  type DirectArchetypeId,
} from "@/editor/selectionDirectArchetypes";
import {
  ENCOUNTER_ARCHETYPES,
  ENCOUNTER_ARCHETYPE_CATEGORIES,
  buildEncounterArchetypePrompt,
  getEncounterArchetype,
  recommendedEncounterArchetypes,
  type EncounterArchetypeCategory,
  type EncounterArchetypeId,
} from "@/editor/selectionEncounterArchetypes";
import { addMapLocation, renameMapLocation } from "@/project/mapNamedLocations";
import { recordMapEditIfChanged } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { openWalkEncounterForSelection } from "@/editor/panels/walkEncounterModal";
import { openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { buildSvgIcon, makeSvgIcon, type SvgNodeSpec } from "@/editor/panels/tileToolbarIcons";
import { installDelayedTooltips } from "@/editor/delayedTooltipRollout";
import { loadAiConfig } from "@/ai/llmClient";
import { getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { isAssistantEndpointReady } from "@/ai/assistantEndpoint";

/** 이 칸 수를 넘는 「지우기」는 두 번 눌러야 실행된다. 3×4 이하는 즉시 실행(기존 동작). */
export const CLEAR_CONFIRM_CELLS = 12;

/** 입력창이 자라는 상한(줄). 넘으면 입력창 안에서 스크롤한다. */
const PROMPT_MAX_LINES = 6;

type ArchetypeDrawerMode = "npc" | "direct" | "encounter";
type DrawerMode = ArchetypeDrawerMode | "ai" | "tag" | null;

function isArchetypeDrawer(mode: DrawerMode): mode is ArchetypeDrawerMode {
  return mode === "npc" || mode === "direct" || mode === "encounter";
}

/** 우클릭/선택 드래그로 잡은 영역의 칩 바만 띄운다. Ctrl+V 고스트·확정 뒤에는 숨긴다. */
export function shouldShowSelectionActionChips(state: {
  readonly selection: TileSelection | null;
  readonly pastePreview: { readonly x: number; readonly y: number } | null;
  readonly mapId: string | null;
}): boolean {
  if (state.pastePreview) return false;
  if (!state.selection || !state.mapId) return false;
  return state.selection.mapId === state.mapId;
}

export interface SelectionChipPreset {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  /** null이면 입력창의 문장을 보낸다. */
  readonly instruction: string | null;
}

export const SELECTION_CHIP_PRESETS: readonly SelectionChipPreset[] = [
  { id: "ai", label: "AI", title: "이 영역에 AI 지시 실행 (Enter)", instruction: null },
  {
    id: "polish",
    label: "다듬기",
    title: "다듬기 — 주변과 어울리게 AI가 다시 짜기",
    instruction: POLISH_INSTRUCTION,
  },
] as const;

export const SELECTION_PLACE_PRESETS: readonly SelectionChipPreset[] = [
  { id: "village", label: "마을", title: "이 자리에 마을 — 지형은 둔 채 집·길만", instruction: "이 선택 영역 안에만 마을을 지어 줘. 집·길·울타리·소품만 깔고 높이·경사로·물은 그대로 둠다." },
  { id: "dungeon", label: "던전", title: "이 자리에 던전 입구 — 안쪽은 새 던전 맵", instruction: "이 선택 영역 안에 던전 입구를 두고, 그 입구로 이어지는 새 던전 맵을 만들어 줘(author_dungeon 의 entrance 로 이 맵의 그 칸을 가리킨다). 이 맵의 높이·경사로·물은 그대로 둔다." },
  { id: "forest", label: "숲", title: "이 자리에 숲 — 나무·빈터·오솛길", instruction: "이 선택 영역 안에만 숲을 만들어 줘. 나무 군집·빈터·오솛길만 깔고 절벽 칸·물은 피하며 높이·경사로·물은 그대로 둔다." },
  { id: "harbor", label: "항구", title: "이 자리에 항구 — 물가에 부두·배", instruction: "이 선택 영역 안에만 항구를 만들어 줘. 물가에 부두·배·창고를 놓고, 물이 없으면 물가를 포함해 다시 고르라고 알려 줘. 높이·경사로·물은 그대로 둔다." },
] as const;

/**
 * 「마을」 칩: 선택 안에만 집·길을 직접 짓는다(높이·경사로·물 안 건드림). 지었거나 사람에게 이유와 빠져나갈 길을 보였으면 true,
 * 이 칩셋에 바로 앉힐 집이 없으면 false(호출자가 조수에게 넘긴다).
 */
export function buildVillageInSelection(selection: TileSelection): boolean {
  const project = store.getCurrent(), map = project.maps[selection.mapId], tileset = map ? project.tilesets[map.tilesetId] : undefined;
  if (!map || !tileset) return false;
  if (!canEditMap(selection.mapId)) { toast(mapEditLockNotice(selection.mapId), "error"); return true; }
  const rect = { x: selection.x, y: selection.y, width: selection.width, height: selection.height };
  const plan = planSelectionVillage(map, tileset, rect);
  if (plan.apply) {
    const cells = plan.cells.flatMap((i) => [{ x: i % map.width, y: Math.floor(i / map.width), layer: "lower" as const }, { x: i % map.width, y: Math.floor(i / map.width), layer: "upper" as const }]);
    recordMapEditIfChanged(selection.mapId, () => store.updateMapTiles(selection.mapId, plan.apply!, { label: `마을 · ${plan.reason}`, cells }), { label: "마을" });
    toast(`마을을 지었습니다 — ${plan.reason} · 땅 모양은 그대로`, "ok");
    return true;
  }
  if (plan.reason.startsWith("이 칩셋에는")) return false;
  if (plan.blockedByLocks) {
    toast(`${plan.reason} — 이 사각형의 칸 잠금만 풀고 지을 수 있습니다`, { kind: "info", action: { label: "여기만 잠금 풀고 짓기", testid: "village-unlock-here", onClick: () => {
      const inRect = (i: number) => { const x = i % map.width, y = Math.floor(i / map.width); return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height; };
      recordMapEditIfChanged(selection.mapId, () => store.updateMap(selection.mapId, (draft) => {
        const kept = (draft.terrainDesign?.lockedCells ?? []).filter((i) => !inRect(i));
        draft.terrainDesign = { ...draft.terrainDesign, lockedCells: kept.length ? kept : undefined };
      }, { label: "칸 잠금 풀기" }), { label: "칸 잠금 풀기" });
      buildVillageInSelection(selection);
    } } });
    return true;
  }
  toast(plan.reason, { kind: "info", action: { label: "조수에게 맡기기", testid: "village-hand-to-assistant", onClick: () => { requestAiRegionHandoff(selectionHandoff(selection, SELECTION_PLACE_PRESETS[0]!.instruction ?? "", false)); } } });
  return true;
}

/** 바가 조수에게 넘기는 모양. 순수 함수 — 테스트가 이 계약을 본다. */
export function selectionHandoff(
  selection: TileSelection,
  instruction: string,
  stamp: boolean,
): Parameters<typeof requestAiRegionHandoff>[0] {
  return {
    mapId: selection.mapId,
    region: { x: selection.x, y: selection.y, width: selection.width, height: selection.height },
    instruction,
    autoRun: true,
    stamp,
  };
}

const ICON_COPY: readonly SvgNodeSpec[] = [
  { tag: "rect", attrs: { x: "7.5", y: "7.5", width: "11", height: "11", rx: "2" } },
  { tag: "path", attrs: { d: "M14.5 7.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v8A1.5 1.5 0 0 0 5 14.5h2.5" } },
];
const ICON_PASTE: readonly SvgNodeSpec[] = [
  { tag: "path", attrs: { d: "M8 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h10a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 16 4.5h-2" } },
  { tag: "rect", attrs: { x: "8", y: "2.5", width: "6", height: "4", rx: "1" } },
  { tag: "path", attrs: { d: "M8 11h6M8 14.5h4" } },
];
const ICON_TRASH: readonly SvgNodeSpec[] = [
  { tag: "path", attrs: { d: "M4 6h14" } },
  { tag: "path", attrs: { d: "M8.5 6V4.5A1 1 0 0 1 9.5 3.5h3a1 1 0 0 1 1 1V6" } },
  { tag: "path", attrs: { d: "M5.5 6l.9 11.6A1.5 1.5 0 0 0 7.9 19h6.2a1.5 1.5 0 0 0 1.5-1.4L16.5 6" } },
  { tag: "path", attrs: { d: "M9.5 10v5M12.5 10v5" } },
];
const ICON_STAMP: readonly SvgNodeSpec[] = [
  { tag: "path", attrs: { d: "M12.5 2.5L5 12.5h5.5l-1 7 7.5-10h-5.5l1-7z" } },
];
const ICON_SEND: readonly SvgNodeSpec[] = [
  { tag: "path", attrs: { d: "M11 17.5V5" } },
  { tag: "path", attrs: { d: "M5.5 10.5L11 5l5.5 5.5" } },
];

function makeAiSparkIcon(className = "selection-action-spark"): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add(className);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M12 2.5l1.35 5.15L18.5 9 13.35 10.35 12 15.5l-1.35-5.15L5.5 9l5.15-1.35L12 2.5zm6.2 9.3l.75 2.85 2.85.75-2.85.75-.75 2.85-.75-2.85-2.85-.75 2.85-.75.75-2.85zM5.8 14.8l.55 2.1 2.1.55-2.1.55-.55 2.1-.55-2.1-2.1-.55 2.1-.55.55-2.1z",
  );
  path.setAttribute("fill", "currentColor");
  svg.append(path);
  return svg;
}

function iconButton(input: {
  readonly testid: string;
  readonly title: string;
  readonly icon: SVGSVGElement;
  readonly className?: string;
  readonly onClick?: (event: Event) => void;
}): HTMLButtonElement {
  return el("button", {
    class: "selection-action-chip is-icon" + (input.className ? ` ${input.className}` : ""),
    attrs: { type: "button", title: input.title, "aria-label": input.title },
    dataset: { testid: `selection-chip-${input.testid}` },
    children: [input.icon],
    ...(input.onClick ? { on: { click: input.onClick } } : {}),
  }) as HTMLButtonElement;
}

function autosizePrompt(prompt: HTMLTextAreaElement): void {
  const style = prompt.style;
  if (!style) return;
  const lineHeight = 20;
  const padding = 10;
  const min = lineHeight + padding;
  const max = lineHeight * PROMPT_MAX_LINES + padding;
  style.height = "auto";
  const content = prompt.scrollHeight || min;
  style.height = `${Math.min(max, Math.max(min, content))}px`;
  style.overflowY = content > max ? "auto" : "hidden";
}

/**
 * 입력창이 현재 펼쳐져 있을 때만 포커스를 준다.
 * 안 B 초기 상태(접힘)에서는 캔버스 포커스를 빼앗지 않아 드래그 직후 Ctrl+C·Del·Esc 가 바로 먹힌다.
 */
export function focusSelectionActionPrompt(bar: HTMLElement): void {
  const composer = bar.querySelector?.(".selection-action-drawer-composer") as HTMLElement | null | undefined;
  if (!composer || composer.hidden) return;
  const prompt = bar.querySelector?.(".selection-action-prompt") as HTMLTextAreaElement | null | undefined;
  if (!prompt || typeof prompt.focus !== "function") return;
  prompt.focus({ preventScroll: true });
}

function fallbackActions(): readonly SelectionQuickAction[] {
  return [
    { kind: "npc", rank: 1, label: "NPC 추가", title: "이 영역에 NPC 추가", score: 60, reason: "인물 배치", instruction: "이 선택 영역에 어울리는 NPC와 대화를 배치해 줘." },
    { kind: "direct", rank: 2, label: "맵 디렉팅", title: "이 영역 다듬기", score: 50, reason: "주변 어울림", instruction: POLISH_INSTRUCTION },
    { kind: "encounter", rank: 3, label: "몹 조우", title: "걸을 때 적 만나기", score: 30, reason: "인카운터 설정", instruction: null },
  ];
}

function quickActionIcon(kind: SelectionQuickAction["kind"]): SVGSVGElement {
  if (kind === "npc") return makeSvgIcon("npc");
  if (kind === "encounter") return makeSvgIcon("combat");
  return makeSvgIcon("polish");
}

export function renderSelectionActionChips(
  selection: TileSelection,
  handoff: typeof requestAiRegionHandoff = requestAiRegionHandoff,
  onPastePreviewCancel: () => void = () => undefined,
): HTMLElement {
  const hasClipboard = editorState.get().clipboard !== null;
  const bar = el("div", {
    class: "selection-action-chips is-compact-hud",
    attrs: { role: "toolbar", "aria-label": "선택 영역 작업" },
    dataset: { testid: "selection-action-chips" },
  });

  const aiConfig = loadAiConfig();
  const aiReady = isAssistantEndpointReady(aiConfig, getAiConnectionStatus(aiConfig));
  const reasonId = `selection-ai-reason-${selection.x}-${selection.y}`;
  const reason = el("span", {
    class: "visually-hidden",
    attrs: { id: reasonId },
    text: aiReady ? "" : "AI 연결이 필요합니다. 오른쪽 조수에서 「AI 연결하기」를 누르세요.",
  });

  const project = store.getCurrent();
  const map = project?.maps?.[selection.mapId];
  const intent: SelectionIntentAnalysis | null = map
    ? analyzeSelectionIntent(project, map, selection, editorState.get().layer)
    : null;

  const actions = intent?.actions ?? fallbackActions();
  const suggestedNpcCell = intent
    ? intent.suggestedNpcCell
    : {
        x: selection.x + Math.floor(Math.max(1, selection.width) / 2),
        y: selection.y + Math.floor(Math.max(1, selection.height) / 2),
      };

  const npcRec = recommendedNpcArchetypes(intent?.zone ?? null);
  let activeNpcCategory: "rec" | NpcArchetypeCategory = "rec";
  let selectedNpcArchetypeId: NpcArchetypeId = npcRec.items[0]?.id ?? "shop";

  const directRec = recommendedDirectArchetypes(intent?.zone ?? null);
  let activeDirectCategory: "rec" | DirectArchetypeCategory = "rec";
  let selectedDirectArchetypeId: DirectArchetypeId = directRec.items[0]?.id ?? "street";

  const encounterRec = recommendedEncounterArchetypes(intent?.zone ?? null);
  let activeEncounterCategory: "rec" | EncounterArchetypeCategory = "rec";
  let selectedEncounterArchetypeId: EncounterArchetypeId = encounterRec.items[0]?.id ?? "walk_random";

  let specPreviewOpen = false;

  let activeZoneLabel = intent?.zone.label ?? "선택 영역";
  let activeLocationId = intent?.zone.locationId;
  let drawerMode: DrawerMode = null;

  const activeArchetypeInfo = (mode: ArchetypeDrawerMode): { readonly icon: string; readonly label: string; readonly memoPlaceholder: string } => {
    if (mode === "npc") return getNpcArchetype(selectedNpcArchetypeId);
    if (mode === "direct") return getDirectArchetype(selectedDirectArchetypeId);
    return getEncounterArchetype(selectedEncounterArchetypeId);
  };

  const defaultPlaceholder = (): string => {
    if (!aiReady) return "AI 연결 후 지시할 수 있어요";
    if (isStampPlaceOn()) return "바로 깔기 — 비우면 알아서";
    if (isArchetypeDrawer(drawerMode)) {
      const arch = activeArchetypeInfo(drawerMode);
      return `추가 메모 (선택 · ${arch.memoPlaceholder})`;
    }
    return `${activeZoneLabel} · AI에게 시킬 일…`;
  };

  const currentZone = () =>
    intent
      ? {
          ...intent.zone,
          label: activeZoneLabel,
          ...(activeLocationId ? { locationId: activeLocationId, source: "location" as const } : {}),
        }
      : null;

  const buildCurrentArchetypePrompt = (mode: ArchetypeDrawerMode): string => {
    const userMemo = prompt.value.trim();
    const zone = currentZone();
    if (mode === "npc") {
      return buildNpcArchetypePrompt({
        archetypeId: selectedNpcArchetypeId,
        project,
        map,
        selection,
        zone,
        zoneLabel: activeZoneLabel,
        zoneSaved: Boolean(activeLocationId),
        suggestedCell: suggestedNpcCell,
        userMemo,
      });
    }
    if (mode === "direct") {
      return buildDirectArchetypePrompt({
        archetypeId: selectedDirectArchetypeId,
        project,
        map,
        selection,
        zone,
        zoneLabel: activeZoneLabel,
        zoneSaved: Boolean(activeLocationId),
        userMemo,
      });
    }
    return buildEncounterArchetypePrompt({
      archetypeId: selectedEncounterArchetypeId,
      project,
      map,
      selection,
      zone,
      zoneLabel: activeZoneLabel,
      zoneSaved: Boolean(activeLocationId),
      suggestedCell: suggestedNpcCell,
      userMemo,
    });
  };

  const handOff = (instruction: string, stamp: boolean): boolean => {
    if (!canEditMap(selection.mapId)) {
      toast(mapEditLockNotice(selection.mapId), "error");
      return false;
    }
    handoff(selectionHandoff(selection, instruction, stamp));
    return true;
  };

  const prompt = el("textarea", {
    class: "selection-action-prompt",
    attrs: {
      rows: "1",
      placeholder: defaultPlaceholder(),
      "aria-label": "이 영역에 내릴 AI 지시",
      spellcheck: "false",
      ...(aiReady ? {} : { "aria-disabled": "true", "aria-describedby": reasonId }),
    },
    dataset: { testid: "selection-chip-prompt" },
  }) as HTMLTextAreaElement;

  const aiPreset = SELECTION_CHIP_PRESETS.find((preset) => preset.id === "ai")!;
  const submitPrompt = (): void => {
    if (!aiReady) {
      toast("AI 연결 후 실행할 수 있어요", "info");
      return;
    }
    const stamp = isStampPlaceOn();
    if (isArchetypeDrawer(drawerMode)) {
      const detailed = buildCurrentArchetypePrompt(drawerMode);
      if (!handOff(detailed, stamp)) return;
      prompt.value = "";
      autosizePrompt(prompt);
      setDrawerMode(null);
      syncSendState();
      return;
    }
    const text = prompt.value.trim();
    if (!text && !stamp) {
      toast("이 영역에 무엇을 할지 적어 주세요", "info");
      prompt.focus?.({ preventScroll: true });
      return;
    }
    if (!handOff(text, stamp)) return;
    prompt.value = "";
    autosizePrompt(prompt);
    setDrawerMode(null);
    syncSendState();
  };

  const send = iconButton({
    testid: "ai",
    title: aiPreset.title,
    icon: buildSvgIcon(ICON_SEND),
    className: "is-primary selection-action-send",
    onClick: () => submitPrompt(),
  });

  const stampButton = iconButton({
    testid: "stamp",
    title: "바로 깔기",
    icon: buildSvgIcon(ICON_STAMP),
    className: "selection-action-stamp",
    onClick: () => setStampPlaceOn(!isStampPlaceOn()),
  });

  const syncSendState = (): void => {
    const isArchMode = isArchetypeDrawer(drawerMode);
    const empty = prompt.value.trim().length === 0;
    const stamp = isStampPlaceOn();
    const canSubmitWithoutText = stamp || isArchMode;
    send.classList?.toggle?.("is-empty", empty && !canSubmitWithoutText);
    send.disabled = !aiReady || (empty && !canSubmitWithoutText);
    const activeArch = isArchetypeDrawer(drawerMode) ? activeArchetypeInfo(drawerMode) : null;
    send.setAttribute(
      "title",
      !aiReady
        ? "AI 연결 후 실행할 수 있어요"
        : activeArch
          ? `${activeArch.icon} ${activeArch.label} 상세 프롬프트로 AI 실행 (Enter)`
          : stamp
            ? "바로 깔기 (Enter) — 비우면 알아서"
            : empty
              ? "할 일을 적으면 실행할 수 있어요 (Enter)"
              : aiPreset.title,
    );
    stampButton.setAttribute("aria-pressed", String(stamp));
    stampButton.classList?.toggle?.("is-active", stamp);
    stampButton.setAttribute(
      "title",
      stamp
        ? "바로 깔기 켜짐 — Enter 가 계획·승인 없이 곧바로 깐다. 누르면 끈다"
        : "바로 깔기 — 켜면 Enter 가 계획·승인 없이 곧바로 깐다",
    );
    stampButton.setAttribute("aria-label", "바로 깔기");
    prompt.setAttribute("placeholder", defaultPlaceholder());
  };

  const dismiss = (): void => {
    cancelPastePreview();
    clearSelection();
    onPastePreviewCancel();
  };

  // ── 더보기 팝오버 안의 보조 도구 (복사·붙여넣기·마을/던전/숲/항구·구조물 저장·지우기) ──
  const morePopover = el("div", {
    class: "selection-action-more-popover",
    attrs: { role: "menu", hidden: "hidden" },
    dataset: { testid: "selection-more-popover" },
  });
  const closeMorePopover = (): void => {
    morePopover.hidden = true;
    moreButton.setAttribute("aria-expanded", "false");
    moreButton.classList?.remove?.("is-active");
  };

  const makeMenuItem = (input: {
    readonly testid: string;
    readonly label: string;
    readonly shortcut?: string;
    readonly title: string;
    readonly icon?: SVGSVGElement;
    readonly className?: string;
    readonly disabled?: boolean;
    readonly onClick: (event: Event) => void;
  }): HTMLButtonElement => {
    const btn = el("button", {
      class: `selection-action-more-item${input.className ? ` ${input.className}` : ""}`,
      attrs: { type: "button", role: "menuitem", title: input.title },
      dataset: { testid: `selection-chip-${input.testid}` },
      children: [
        ...(input.icon ? [input.icon] : []),
        el("span", { class: "selection-action-more-label", text: input.label }),
        ...(input.shortcut ? [el("span", { class: "selection-action-more-kbd", text: input.shortcut })] : []),
      ],
      on: { click: input.onClick },
    }) as HTMLButtonElement;
    if (input.disabled) btn.disabled = true;
    return btn;
  };

  const copyButton = makeMenuItem({
    testid: "copy",
    label: "복사",
    shortcut: "Ctrl+C",
    title: "복사 (Ctrl+C)",
    icon: buildSvgIcon(ICON_COPY),
    onClick: () => {
      copySelection(selection.mapId);
      closeMorePopover();
    },
  });

  const pasteButton = hasClipboard
    ? makeMenuItem({
        testid: "paste",
        label: "붙여넣기",
        shortcut: "Ctrl+V",
        title: "붙여넣기 (Ctrl+V)",
        icon: buildSvgIcon(ICON_PASTE),
        onClick: () => {
          enterPastePreview(selection.mapId, selection.x, selection.y);
          closeMorePopover();
        },
      })
    : null;

  const structureButton = makeMenuItem({
    testid: "save-structure",
    label: "구조물로 저장",
    title: "구조물로 저장 — 이 맵 타일셋의 구조물 킷으로",
    icon: makeSvgIcon("structure"),
    onClick: () => {
      saveSelectionAsStructureKit(selection);
      closeMorePopover();
    },
  });

  const placeButtons = SELECTION_PLACE_PRESETS.map((preset) =>
    makeMenuItem({
      testid: preset.id,
      label: `${preset.label} 짓기`,
      shortcut: preset.id === "village" ? "즉시" : "AI",
      title: preset.title,
      disabled: !aiReady && preset.id !== "village",
      onClick: () => {
        closeMorePopover();
        if (preset.id === "village" && buildVillageInSelection(selection)) return;
        handOff(preset.instruction ?? "", false);
      },
    }),
  );

  const clearCells = Math.max(0, selection.width) * Math.max(0, selection.height);
  const clearLabel = el("span", { class: "selection-action-more-label", text: "지우기" });
  const clearButton = el("button", {
    class: "selection-action-more-item is-danger",
    attrs: { type: "button", role: "menuitem", title: "지우기 (Del)" },
    dataset: { testid: "selection-chip-clear" },
    children: [buildSvgIcon(ICON_TRASH), clearLabel, el("span", { class: "selection-action-more-kbd", text: "Del" })],
  }) as HTMLButtonElement;
  let clearArmed = false;
  let clearArmTimer: ReturnType<typeof setTimeout> | null = null;
  const disarmClear = (): void => {
    clearArmed = false;
    if (clearArmTimer !== null) clearTimeout(clearArmTimer);
    clearArmTimer = null;
    clearLabel.textContent = "지우기";
    clearButton.classList?.remove?.("is-armed");
  };
  clearButton.addEventListener("click", () => {
    if (clearCells <= CLEAR_CONFIRM_CELLS || clearArmed) {
      disarmClear();
      clearSelectionRegion(selection.mapId);
      closeMorePopover();
      return;
    }
    clearArmed = true;
    clearLabel.textContent = `${clearCells}칸 지울까요?`;
    clearButton.classList?.add?.("is-armed");
    clearArmTimer = setTimeout(disarmClear, 4000);
  });

  morePopover.append(
    copyButton,
    ...(pasteButton ? [pasteButton] : []),
    el("div", { class: "selection-action-more-sep", attrs: { "aria-hidden": "true" } }),
    ...placeButtons,
    structureButton,
    el("div", { class: "selection-action-more-sep", attrs: { "aria-hidden": "true" } }),
    clearButton,
  );

  // ── 1줄 메인 컴팩트 HUD 행: [1] [2] [3] [4 ✦ 조수 지시] | [📍] [···] [✕] ──
  const quickButtonMap = new Map<SelectionQuickAction["kind"], HTMLButtonElement>();
  const quickButtons = actions.map((action) => {
    const testid = `selection-chip-quick-${action.kind}`;
    const btn = el("button", {
      class: `selection-action-context-btn${action.rank === 1 ? " is-top" : ""}`,
      attrs: {
        type: "button",
        title: `${action.title} (${action.reason})`,
      },
      dataset: {
        testid,
        quickKind: action.kind,
        rank: String(action.rank),
      },
      children: [
        el("span", { class: "selection-action-context-rank", text: String(action.rank) }),
        quickActionIcon(action.kind),
        el("span", { text: action.label }),
      ],
      on: {
        click: () => {
          closeMorePopover();
          setDrawerMode(drawerMode === action.kind ? null : action.kind);
        },
      },
    }) as HTMLButtonElement;
    quickButtonMap.set(action.kind, btn);
    return btn;
  });

  const aiToggleButton = el("button", {
    class: "selection-action-context-btn is-ai-toggle",
    attrs: { type: "button", title: "조수에게 자유롭게 텍스트로 지시 (4)" },
    dataset: { testid: "selection-chip-ai-toggle", rank: "4" },
    children: [
      el("span", { class: "selection-action-context-rank", text: "4" }),
      makeAiSparkIcon("selection-action-context-spark"),
      el("span", { text: "조수 지시" }),
    ],
    on: {
      click: () => {
        closeMorePopover();
        setDrawerMode(drawerMode === "ai" ? null : "ai");
      },
    },
  }) as HTMLButtonElement;

  const zonePinLabel = el("span", {
    class: "selection-action-zone-pin-text",
    text: activeLocationId ? activeZoneLabel : "",
  });
  const zoneTagButton = el("button", {
    class: `selection-action-zone-pin${activeLocationId ? " is-saved" : ""}`,
    attrs: {
      type: "button",
      title: activeLocationId
        ? `저장된 구역 태그: 「${activeZoneLabel}」 — 눌러서 이름 수정`
        : `감지된 구역: ${activeZoneLabel} — 눌러서 구역 태그(map.locations)로 저장`,
      "aria-label": "구역 태그 설정",
    },
    dataset: { testid: "selection-chip-zone-tag", zoneSource: intent?.zone.source ?? "tiles" },
    children: [makeSvgIcon("pin"), zonePinLabel],
    on: {
      click: () => {
        closeMorePopover();
        setDrawerMode(drawerMode === "tag" ? null : "tag");
      },
    },
  }) as HTMLButtonElement;

  const moreMenuItems = (): HTMLButtonElement[] =>
    Array.from(morePopover.querySelectorAll?.<HTMLButtonElement>(".selection-action-more-item:not(:disabled)") ?? []);

  const openMorePopover = (focusFirst = false): void => {
    const rect = typeof bar.getBoundingClientRect === "function" ? bar.getBoundingClientRect() : null;
    morePopover.classList?.toggle?.("is-below", Boolean(rect && rect.top > 0 && rect.top < 280));
    morePopover.hidden = false;
    moreButton.setAttribute("aria-expanded", "true");
    moreButton.classList?.add?.("is-active");
    if (focusFirst) {
      moreMenuItems()[0]?.focus?.({ preventScroll: true });
    }
  };

  const moreButton = iconButton({
    testid: "more",
    title: "더보기 — 복사(Ctrl+C)·지우기(Del)·마을/숲/항구·구조물 저장",
    icon: makeSvgIcon("more"),
    onClick: (event) => {
      const opening = Boolean(morePopover.hidden);
      if (opening) {
        const isKeyboard = (event as MouseEvent).detail === 0;
        openMorePopover(isKeyboard);
      } else {
        closeMorePopover();
      }
    },
  });
  moreButton.setAttribute("aria-haspopup", "menu");
  moreButton.setAttribute("aria-expanded", "false");
  moreButton.addEventListener("keydown", (raw) => {
    const event = raw as KeyboardEvent;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (morePopover.hidden) openMorePopover(true);
      else {
        const items = moreMenuItems();
        (event.key === "ArrowDown" ? items[0] : items[items.length - 1])?.focus?.({ preventScroll: true });
      }
    }
  });
  morePopover.addEventListener("keydown", (raw) => {
    const event = raw as KeyboardEvent;
    const items = moreMenuItems();
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(idx + 1 + items.length) % items.length]?.focus?.({ preventScroll: true });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus?.({ preventScroll: true });
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus?.({ preventScroll: true });
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus?.({ preventScroll: true });
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMorePopover();
      moreButton.focus?.({ preventScroll: true });
    }
  });

  const dismissButton = iconButton({
    testid: "dismiss",
    title: "선택 해제 (Esc)",
    icon: makeSvgIcon("close"),
    className: "selection-action-chip-dismiss",
    onClick: dismiss,
  });

  const primaryRow = el("div", {
    class: "selection-action-compact-row",
    dataset: { testid: "selection-context-row" },
    children: [
      el("div", { class: "selection-action-context-actions", children: [...quickButtons, aiToggleButton] }),
      el("span", { class: "selection-action-sep", attrs: { "aria-hidden": "true" } }),
      el("div", { class: "selection-action-compact-utils", children: [zoneTagButton, moreButton, dismissButton] }),
    ],
  });

  // ── 펼침 서랍: NPC 12종 아키타입 팔레트 / 디렉팅 프리셋 + AI 입력 줄 / 구역 태그 편집 줄 ──
  const drawerGuardrail = el("div", { class: "selection-action-drawer-guardrail" });
  const npcPalette = el("div", {
    class: "selection-action-palette",
    attrs: { hidden: "hidden" },
    dataset: { testid: "selection-npc-palette" },
  });
  const npcCatRow = el("div", { class: "selection-action-cat-row" });
  const npcGrid = el("div", { class: "selection-action-grid", dataset: { testid: "selection-action-grid" } });
  const npcSpecSummary = el("span", { class: "selection-action-spec-summary" });
  const npcSpecToggle = el("button", {
    class: "selection-action-spec-toggle",
    text: "상세 프롬프트 보기 ▾",
    attrs: { type: "button" },
    dataset: { testid: "selection-npc-spec-toggle" },
  }) as HTMLButtonElement;
  const npcSpecBar = el("div", {
    class: "selection-action-spec-bar",
    children: [npcSpecSummary, npcSpecToggle],
  });
  const npcSpecPreview = el("pre", {
    class: "selection-action-spec-preview",
    attrs: { hidden: "hidden" },
    dataset: { testid: "selection-npc-spec-preview" },
  });
  npcPalette.append(npcCatRow, npcGrid, npcSpecBar, npcSpecPreview);

  const drawerComposer = el("div", {
    class: "selection-action-drawer-composer",
    attrs: { hidden: "hidden" },
    children: [makeAiSparkIcon(), prompt, stampButton, send],
  });

  const tagInput = el("input", {
    class: "selection-action-zone-tag-input",
    attrs: {
      type: "text",
      maxlength: "64",
      placeholder: "구역 이름 (예: 버들 중앙 광장)",
      "aria-label": "구역 태그 이름",
      spellcheck: "false",
    },
    dataset: { testid: "selection-zone-tag-input" },
  }) as HTMLInputElement;
  const tagSaveBtn = el("button", {
    class: "selection-action-zone-tag-save",
    text: "저장",
    attrs: { type: "submit" },
    dataset: { testid: "selection-zone-tag-save" },
  }) as HTMLButtonElement;
  const tagEditor = el("form", {
    class: "selection-action-zone-tag-editor",
    attrs: { hidden: "hidden" },
    children: [
      el("span", { class: "selection-action-zone-tag-caption", text: "구역 태그" }),
      tagInput,
      tagSaveBtn,
    ],
  }) as HTMLFormElement;

  const drawer = el("div", {
    class: "selection-action-drawer",
    attrs: { hidden: "hidden" },
    dataset: { testid: "selection-drawer" },
    children: [drawerGuardrail, npcPalette, drawerComposer, tagEditor],
  });

  const saveZoneTag = (): void => {
    const nextName = tagInput.value.trim();
    if (!nextName) {
      setDrawerMode(null);
      return;
    }
    if (!canEditMap(selection.mapId)) {
      toast(mapEditLockNotice(selection.mapId), "error");
      setDrawerMode(null);
      return;
    }
    let savedLocationId = activeLocationId;
    let savedName = nextName;
    let errorMessage: string | null = null;
    recordMapEditIfChanged(
      selection.mapId,
      () =>
        store.updateMap(
          selection.mapId,
          (draft) => {
            const res = activeLocationId
              ? renameMapLocation(draft, activeLocationId, nextName)
              : addMapLocation(draft, {
                  name: nextName,
                  x: selection.x,
                  y: selection.y,
                  w: selection.width,
                  h: selection.height,
                  tags: intent?.zone.suggestedZoneTags ?? [],
                });
            if (!res.ok) {
              errorMessage = res.error;
              return;
            }
            savedLocationId = res.location.id;
            savedName = res.location.name;
          },
          { label: activeLocationId ? "구역 태그 이름 변경" : "구역 태그 저장" },
        ),
      { label: "구역 태그" },
    );
    if (errorMessage) {
      toast(errorMessage, "error");
      setDrawerMode(null);
      return;
    }
    activeLocationId = savedLocationId;
    activeZoneLabel = savedName;
    zoneTagButton.classList?.add?.("is-saved");
    zoneTagButton.dataset.zoneSource = "location";
    zonePinLabel.textContent = savedName;
    zoneTagButton.setAttribute("title", `저장된 구역 태그: 「${savedName}」 — 눌러서 이름 수정`);
    prompt.setAttribute("placeholder", defaultPlaceholder());
    toast(`구역 태그 저장: 「${savedName}」`, "ok");
    setDrawerMode(null);
  };

  tagEditor.addEventListener("submit", (event) => {
    event.preventDefault();
    saveZoneTag();
  });
  tagInput.addEventListener("keydown", (raw) => {
    const event = raw as KeyboardEvent;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setDrawerMode(null);
    }
  });

  const syncArchetypeSpecPreview = (): void => {
    if (!isArchetypeDrawer(drawerMode)) return;
    const arch = activeArchetypeInfo(drawerMode);
    npcSpecSummary.textContent = `선택: ${arch.icon} ${arch.label} · 구역·세계관 상세 프롬프트 자동 조립`;
    npcSpecToggle.textContent = specPreviewOpen ? "상세 프롬프트 접기 ▴" : "상세 프롬프트 보기 ▾";
    npcSpecPreview.hidden = !specPreviewOpen;
    if (specPreviewOpen) {
      npcSpecPreview.textContent = buildCurrentArchetypePrompt(drawerMode);
    }
  };

  npcSpecToggle.addEventListener("click", () => {
    specPreviewOpen = !specPreviewOpen;
    syncArchetypeSpecPreview();
  });

  const renderArchetypePalette = (mode: ArchetypeDrawerMode): void => {
    npcPalette.dataset.testid = `selection-${mode}-palette`;
    npcGrid.dataset.testid = `selection-${mode}-grid`;
    npcSpecToggle.dataset.testid = `selection-${mode}-spec-toggle`;
    npcSpecPreview.dataset.testid = `selection-${mode}-spec-preview`;

    const categories: readonly { readonly id: string; readonly label: string }[] =
      mode === "npc"
        ? NPC_ARCHETYPE_CATEGORIES
        : mode === "direct"
          ? DIRECT_ARCHETYPE_CATEGORIES
          : ENCOUNTER_ARCHETYPE_CATEGORIES;

    const activeCat: string =
      mode === "npc"
        ? activeNpcCategory
        : mode === "direct"
          ? activeDirectCategory
          : activeEncounterCategory;

    npcCatRow.textContent = "";
    const tabsWrap = el("div", { class: "selection-action-cats" });
    for (const cat of categories) {
      tabsWrap.append(
        el("button", {
          class: `selection-action-cat-btn${activeCat === cat.id ? " is-active" : ""}`,
          text: cat.id === "rec" ? `✦ ${cat.label}` : cat.label,
          attrs: { type: "button" },
          dataset: { testid: `selection-${mode}-cat-${cat.id}` },
          on: {
            click: () => {
              if (mode === "npc") activeNpcCategory = cat.id as "rec" | NpcArchetypeCategory;
              else if (mode === "direct") activeDirectCategory = cat.id as "rec" | DirectArchetypeCategory;
              else activeEncounterCategory = cat.id as "rec" | EncounterArchetypeCategory;
              renderArchetypePalette(mode);
              const nextBtn = npcCatRow.querySelector?.<HTMLButtonElement>(`[data-testid="selection-${mode}-cat-${cat.id}"]`);
              nextBtn?.focus?.({ preventScroll: true });
            },
          },
        }),
      );
    }

    // 각 서랍 우측 상단의 오프라인 즉시 실행 버튼 (AI 없이 바로 에디터 기능 열기)
    let instantBtn: HTMLElement | null = null;
    if (mode === "npc") {
      instantBtn = el("button", {
        class: "selection-action-instant-btn",
        text: "+ 빈 NPC 직접",
        attrs: {
          type: "button",
          title: suggestedNpcCell
            ? `AI 없이 (${suggestedNpcCell.x}, ${suggestedNpcCell.y})에 새 NPC 이벤트 편집창 바로 열기`
            : "선택 영역에 비어 있는 통행 가능 칸이 없습니다 — 다른 영역을 선택해 주세요",
        },
        dataset: { testid: "selection-chip-npc-direct" },
        on: {
          click: () => {
            if (!canEditMap(selection.mapId)) {
              toast(mapEditLockNotice(selection.mapId), "error");
              return;
            }
            if (!suggestedNpcCell) {
              toast("선택 영역 안에 비어 있는 통행 가능 칸이 없습니다. 다른 영역을 선택해 주세요.", "info");
              return;
            }
            openNewEventEditorModal(selection.mapId, suggestedNpcCell.x, suggestedNpcCell.y);
          },
        },
      });
    } else if (mode === "direct" && intent?.zone.mapRole !== "interior") {
      instantBtn = el("button", {
        class: "selection-action-instant-btn",
        text: "+ 마을 즉시 짓기",
        attrs: {
          type: "button",
          title: "AI 없이 선택 영역에 집·길 바로 배치",
        },
        dataset: { testid: "selection-preset-village-instant" },
        on: {
          click: () => {
            if (!buildVillageInSelection(selection)) {
              activeDirectCategory = "decor";
              selectedDirectArchetypeId = "street";
              prompt.value = "이 선택 영역 안에만 마을의 집·길·소품을 자연스럽게 배치해 줘.";
              autosizePrompt(prompt);
              renderArchetypePalette("direct");
              syncSendState();
              prompt.focus?.({ preventScroll: true });
            }
          },
        },
      });
    } else if (mode === "encounter") {
      instantBtn = el("button", {
        class: "selection-action-instant-btn",
        text: "+ 걷기 전투 직접",
        attrs: {
          type: "button",
          title: "AI 없이 이 영역의 걸을 때 적 만나기(인카운터) 설정창 바로 열기",
        },
        dataset: { testid: "selection-chip-walk-encounter" },
        on: {
          click: () => {
            setDrawerMode(null);
            openWalkEncounterForSelection(selection);
          },
        },
      });
    }

    npcCatRow.append(tabsWrap, ...(instantBtn ? [instantBtn] : []));

    type CardItem = { readonly id: string; readonly icon: string; readonly label: string; readonly summary: string };
    let visibleItems: readonly CardItem[];
    let topIds: ReadonlySet<string>;
    let selectedId: string;

    if (mode === "npc") {
      visibleItems = activeNpcCategory === "rec"
        ? npcRec.items.slice(0, 8)
        : NPC_ARCHETYPES.filter((item) => item.category === activeNpcCategory);
      topIds = npcRec.topIds;
      if (!visibleItems.some((item) => item.id === selectedNpcArchetypeId) && visibleItems[0]) {
        selectedNpcArchetypeId = visibleItems[0].id as NpcArchetypeId;
      }
      selectedId = selectedNpcArchetypeId;
    } else if (mode === "direct") {
      visibleItems = activeDirectCategory === "rec"
        ? directRec.items.slice(0, 8)
        : DIRECT_ARCHETYPES.filter((item) => item.category === activeDirectCategory);
      topIds = directRec.topIds;
      if (!visibleItems.some((item) => item.id === selectedDirectArchetypeId) && visibleItems[0]) {
        selectedDirectArchetypeId = visibleItems[0].id as DirectArchetypeId;
      }
      selectedId = selectedDirectArchetypeId;
    } else {
      visibleItems = activeEncounterCategory === "rec"
        ? encounterRec.items.slice(0, 8)
        : ENCOUNTER_ARCHETYPES.filter((item) => item.category === activeEncounterCategory);
      topIds = encounterRec.topIds;
      if (!visibleItems.some((item) => item.id === selectedEncounterArchetypeId) && visibleItems[0]) {
        selectedEncounterArchetypeId = visibleItems[0].id as EncounterArchetypeId;
      }
      selectedId = selectedEncounterArchetypeId;
    }

    npcGrid.textContent = "";
    for (const item of visibleItems) {
      const isRec = activeCat === "rec" && topIds.has(item.id);
      const isSelected = item.id === selectedId;
      npcGrid.append(
        el("button", {
          class: `selection-action-card${isRec ? " is-rec" : ""}${isSelected ? " is-selected" : ""}`,
          attrs: { type: "button", title: `${item.label} — ${item.summary}` },
          dataset: { testid: `selection-${mode}-arch-${item.id}` },
          children: [
            el("span", {
              class: "selection-action-card-top",
              children: [
                el("span", { class: "selection-action-card-ic", text: item.icon }),
                el("span", { class: "selection-action-card-name", text: item.label }),
              ],
            }),
            el("span", { class: "selection-action-card-sub", text: item.summary }),
          ],
          on: {
            click: () => {
              if (mode === "npc") selectedNpcArchetypeId = item.id as NpcArchetypeId;
              else if (mode === "direct") selectedDirectArchetypeId = item.id as DirectArchetypeId;
              else selectedEncounterArchetypeId = item.id as EncounterArchetypeId;
              renderArchetypePalette(mode);
              syncSendState();
              prompt.focus?.({ preventScroll: true });
            },
          },
        }),
      );
    }

    syncArchetypeSpecPreview();
  };

  function setDrawerMode(next: DrawerMode): void {
    drawerMode = next;
    for (const [kind, btn] of quickButtonMap) {
      btn.classList?.toggle?.("is-active", next === kind);
    }
    aiToggleButton.classList?.toggle?.("is-active", next === "ai");
    zoneTagButton.classList?.toggle?.("is-open", next === "tag");

    if (!next) {
      drawer.hidden = true;
      drawerGuardrail.hidden = true;
      npcPalette.hidden = true;
      drawerComposer.hidden = true;
      tagEditor.hidden = true;
      return;
    }

    drawer.hidden = false;
    if (next === "tag") {
      drawerGuardrail.hidden = true;
      npcPalette.hidden = true;
      drawerComposer.hidden = true;
      tagEditor.hidden = false;
      tagInput.value = activeLocationId ? activeZoneLabel : (intent?.zone.suggestedZoneName ?? activeZoneLabel);
      tagInput.focus?.({ preventScroll: true });
      tagInput.select?.();
      return;
    }

    tagEditor.hidden = true;
    drawerComposer.hidden = false;
    drawerGuardrail.hidden = false;
    drawerGuardrail.textContent = activeLocationId
      ? `📍 ${activeZoneLabel} (태그됨) · 영역·지형·세계관 가드레일 잠금`
      : `📍 ${activeZoneLabel} · 영역·지형·세계관 가드레일 잠금`;

    if (isArchetypeDrawer(next)) {
      npcPalette.hidden = false;
      renderArchetypePalette(next);
    } else {
      npcPalette.hidden = true;
    }

    prompt.setAttribute("placeholder", defaultPlaceholder());
    syncSendState();
    prompt.focus?.({ preventScroll: true });
  }

  // 입력창 & 바 전체 단축키(Ctrl+C/V, Del, Esc) 보존
  prompt.addEventListener("input", () => {
    autosizePrompt(prompt);
    syncSendState();
    if (isArchetypeDrawer(drawerMode) && specPreviewOpen) syncArchetypeSpecPreview();
  });
  prompt.addEventListener("keydown", (raw) => {
    const event = raw as KeyboardEvent;
    if (event.isComposing || event.keyCode === 229) return;
    const empty = prompt.value.length === 0;
    const mod = event.ctrlKey || event.metaKey;
    if (event.key === "Enter" && !event.shiftKey && !mod && !event.altKey) {
      event.preventDefault();
      submitPrompt();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!empty) {
        prompt.value = "";
        autosizePrompt(prompt);
        syncSendState();
        if (isArchetypeDrawer(drawerMode) && specPreviewOpen) syncArchetypeSpecPreview();
        return;
      }
      setDrawerMode(null);
      return;
    }
    if (!empty) return;
    const key = event.key.toLowerCase();
    if (mod && !event.altKey && key === "c") {
      event.preventDefault();
      copyButton.click();
    } else if (mod && !event.altKey && key === "v" && pasteButton) {
      event.preventDefault();
      pasteButton.click();
    } else if (event.key === "Delete") {
      event.preventDefault();
      if (event.repeat) return;
      if (clearCells > CLEAR_CONFIRM_CELLS && !clearArmed && morePopover.hidden) {
        openMorePopover(false);
      }
      clearButton.click();
      if (clearArmed) clearButton.focus?.({ preventScroll: true });
    }
  });

  bar.addEventListener("keydown", (raw) => {
    const event = raw as KeyboardEvent;
    const target = event.target as HTMLElement | null;
    if (target === prompt || target === tagInput) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && !event.altKey && key === "c") {
      event.preventDefault();
      copyButton.click();
    } else if (mod && !event.altKey && key === "v" && pasteButton) {
      event.preventDefault();
      pasteButton.click();
    } else if (event.key === "Delete") {
      event.preventDefault();
      if (event.repeat) return;
      if (clearCells > CLEAR_CONFIRM_CELLS && !clearArmed && morePopover.hidden) {
        openMorePopover(false);
      }
      clearButton.click();
      if (clearArmed) clearButton.focus?.({ preventScroll: true });
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (!morePopover.hidden) {
        closeMorePopover();
        moreButton.focus?.({ preventScroll: true });
      } else if (drawerMode !== null) {
        setDrawerMode(null);
      } else {
        dismiss();
      }
    }
  });

  bar.append(primaryRow, drawer, morePopover, reason);
  syncSendState();

  const unsubscribeStamp = subscribeStampPlace(() => {
    if (!bar.isConnected) {
      unsubscribeStamp();
      return;
    }
    syncSendState();
  });
  installDelayedTooltips(bar);

  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    const releaseFocus = (event: Event): void => {
      if (!bar.isConnected) {
        document.removeEventListener("pointerdown", releaseFocus, true);
        return;
      }
      const target = event.target as Node | null;
      if (target && typeof bar.contains === "function" && bar.contains(target)) return;
      if (!morePopover.hidden) closeMorePopover();
      if (document.activeElement === prompt) prompt.blur();
    };
    document.addEventListener("pointerdown", releaseFocus, true);
  }

  return bar;
}

// editor/panels/aiSelectionContextStrip.ts
// Phase 3 (AI 조수 UI 리뉴얼 × 선택 컨텍스트 통합):
// 1) 플로팅 조수 카드 상단 레일 바로 아래에 「현재 선택 대상(유닛 또는 맵)」 컨텍스트 스트립을 붙인다.
//    - 유닛 선택 시: 실제 스프라이트 + 이름 + 역할/좌표 + 「@지시」(입력창 멘션) + 「편집」(이벤트 모달)
//    - 미선택 시: 현재 맵 요약(이름 · 크기 · 유닛 수) + 「⚙ 설정」(맵 속성 모달)
// 2) 조수 카드가 접혀 있을 때 캔버스 우하단에 깔끔한 플로팅 「✦ 조수」 퀵 오픈 알약을 띄운다.

import { openAiAssistantPanel } from "@/editor/aiAssistantBridge";
import { editorState, type EditorState } from "@/editor/editorState";
import { triggerLabel } from "@/editor/eventMarkerUx";
import { resolveCurrentMapId } from "@/editor/mapSelection";
import { AI_TEAM_WING_STATE_EVENT, type AiTeamWingPillState } from "@/editor/panels/aiTeamWing";
import { renderEventGraphicIcon } from "@/editor/panels/eventEditor/eventGraphicPreview";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { openMapPropertiesDialog } from "@/editor/panels/mapPropertiesDialog";
import { eventDisplayName } from "@/project/eventDisplayName";
import { store } from "@/project/store";
import type { Command, EventPageGraphic, GameEvent, GameMap, Project } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

type UnitKind = "npc" | "enemy" | "portal";

function hasCommand(commands: readonly Command[] | undefined, kind: Command["kind"]): boolean {
  if (!commands) return false;
  for (const cmd of commands) {
    if (cmd.kind === kind) return true;
    if (cmd.kind === "fork" && (hasCommand(cmd.then, kind) || hasCommand(cmd.else, kind))) return true;
    if (cmd.kind === "choices") {
      if (cmd.options.some((opt) => hasCommand(opt.branch, kind)) || hasCommand(cmd.cancelBranch, kind)) return true;
    }
    if (cmd.kind === "loop" && hasCommand(cmd.body, kind)) return true;
  }
  return false;
}

function classifyUnit(ev: GameEvent): UnitKind {
  const pages = ev.pages?.length ? ev.pages : [{ commands: ev.commands }];
  if (pages.some((p) => hasCommand(p.commands, "transfer"))) return "portal";
  if (pages.some((p) => hasCommand(p.commands, "battleProcessing"))) return "enemy";
  if (/적|몬스터|보스|산적|슬라임|전투|enemy|boss|monster/iu.test(ev.name ?? "")) return "enemy";
  return "npc";
}

function unitKindLabel(kind: UnitKind): string {
  if (kind === "enemy") return "적·보스";
  if (kind === "portal") return "이동·문";
  return "NPC";
}

function unitGlyph(kind: UnitKind): string {
  if (kind === "enemy") return "⚔";
  if (kind === "portal") return "⇢";
  return "●";
}

function unitGraphic(ev: GameEvent): EventPageGraphic | null {
  if (!ev.pages?.length) return null;
  for (const page of ev.pages) {
    if (page.graphic.sprite) return page.graphic;
  }
  return ev.pages[0]?.graphic ?? null;
}

function insertMentionIntoComposer(aiPanel: HTMLElement, label: string): void {
  const input = aiPanel.querySelector<HTMLTextAreaElement>(".ai-assistant-input");
  if (!input) return;
  const token = `@${label} `;
  const current = input.value;
  if (!current.startsWith(token)) {
    input.value = current.trim().length === 0 ? token : `${token}${current}`;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  input.focus();
  const end = input.value.length;
  input.setSelectionRange(end, end);
}

function resolveContext(
  project: Project,
  state: EditorState,
): { readonly map: GameMap | null; readonly event: GameEvent | null } {
  const mapId = state.currentMapId ?? resolveCurrentMapId();
  const map = mapId ? project.maps[mapId] ?? null : null;
  if (!map) return { map: null, event: null };
  const event = state.selectedEventId
    ? map.events.find((ev) => ev.id === state.selectedEventId) ?? null
    : null;
  return { map, event };
}

function layerModeLabel(state: EditorState): string {
  if (state.tool === "relief") return "지형";
  if (state.layer === "event") return "유닛";
  if (state.layer === "upper") return "오브젝트";
  return "타일";
}

export function mountAiSelectionContextStrip(
  aiPanel: HTMLElement,
  canvasArea: HTMLElement,
): () => void {
  const strip = el("div", {
    class: "ai-sel-context-strip",
    dataset: { testid: "ai-selection-context-strip" },
    attrs: { role: "region", "aria-label": "현재 선택 컨텍스트" },
  });

  const deck = aiPanel.querySelector<HTMLElement>(".ai-deck");
  const rail = deck?.querySelector<HTMLElement>(".ai-deck-rail") ?? null;
  if (deck && rail) {
    rail.after(strip);
  } else if (deck) {
    deck.prepend(strip);
  }

  const pillBadge = el("span", { class: "fap-badge" });
  pillBadge.hidden = true;
  const pill = el("button", {
    class: "floating-ai-pill",
    attrs: { type: "button", title: "AI 조수 열기", "aria-label": "AI 조수 열기" },
    dataset: { testid: "floating-ai-pill" },
    children: [
      el("span", { class: "fap-sparkle", text: "✦", attrs: { "aria-hidden": "true" } }),
      el("span", { class: "fap-label", text: "조수" }),
      pillBadge,
    ],
    on: {
      click: () => {
        openAiAssistantPanel();
      },
    },
  }) as HTMLButtonElement;
  canvasArea.append(pill);

  let lastSignature = "";
  let teamPillState: AiTeamWingPillState = { active: false, label: "", tone: "idle" };

  const syncPillBadge = (selectedEventName: string | null): void => {
    pillBadge.classList.remove("is-team-running", "is-team-done", "is-team-review", "is-team-failed");
    if (teamPillState.active && teamPillState.label) {
      pillBadge.textContent = teamPillState.label;
      pillBadge.hidden = false;
      if (teamPillState.tone !== "idle") pillBadge.classList.add(`is-team-${teamPillState.tone}`);
      return;
    }
    if (selectedEventName) {
      pillBadge.textContent = selectedEventName;
      pillBadge.hidden = false;
    } else {
      pillBadge.textContent = "";
      pillBadge.hidden = true;
    }
  };

  const syncPillVisibility = (): void => {
    const collapsed = aiPanel.classList.contains("is-collapsed");
    pill.hidden = !collapsed;
  };

  const paint = (): void => {
    const project = store.getCurrent();
    const state = editorState.get();
    const { map, event } = resolveContext(project, state);
    const modeLabel = layerModeLabel(state);

    syncPillBadge(event ? eventDisplayName(event) : null);

    const sig = event && map
      ? `ev:${map.id}:${event.id}:${eventDisplayName(event)}:${classifyUnit(event)}:${triggerLabel(event.pages?.[0]?.trigger ?? event.trigger)}:${event.x},${event.y}:${unitGraphic(event)?.sprite?.id ?? ""}`
      : map
        ? `map:${map.id}:${map.name}:${map.width}x${map.height}:${map.events.length}:${modeLabel}`
        : "none";

    if (sig === lastSignature) return;
    lastSignature = sig;
    clearChildren(strip);

    if (event && map) {
      const kind = classifyUnit(event);
      const name = eventDisplayName(event);
      const trig = triggerLabel(event.pages?.[0]?.trigger ?? event.trigger);
      const graphic = unitGraphic(event);

      const thumb = graphic?.sprite
        ? el("div", {
            class: "ai-sel-thumb",
            children: [renderEventGraphicIcon(graphic, { scale: 1 })],
          })
        : el("div", {
            class: `ai-sel-thumb is-fallback is-${kind}`,
            text: unitGlyph(kind),
          });

      strip.dataset.contextKind = "event";
      strip.append(
        el("span", { class: `ai-sel-bar is-${kind}`, attrs: { "aria-hidden": "true" } }),
        thumb,
        el("div", {
          class: "ai-sel-meta",
          children: [
            el("div", { class: "ai-sel-name", text: name }),
            el("div", {
              class: "ai-sel-sub",
              text: `${unitKindLabel(kind)} · (${event.x}, ${event.y}) · ${trig}`,
            }),
          ],
        }),
        el("div", {
          class: "ai-sel-actions",
          children: [
            el("button", {
              class: "ai-sel-btn is-accent",
              text: "@지시",
              attrs: { type: "button", title: `${name}을(를) 지시창에 멘션` },
              dataset: { testid: "ai-ctx-mention" },
              on: { click: () => insertMentionIntoComposer(aiPanel, name) },
            }),
            el("button", {
              class: "ai-sel-btn",
              text: "편집",
              attrs: { type: "button", title: `${name} 이벤트 편집` },
              dataset: { testid: "ai-ctx-edit" },
              on: { click: () => openEventEditorModal(map.id, event.id) },
            }),
          ],
        }),
      );
      return;
    }

    if (map) {
      strip.dataset.contextKind = "map";
      strip.append(
        el("span", { class: "ai-sel-bar is-map", attrs: { "aria-hidden": "true" } }),
        el("div", {
          class: "ai-sel-meta",
          children: [
            el("div", { class: "ai-sel-name", text: map.name || map.id }),
            el("div", {
              class: "ai-sel-sub",
              text: `${map.width}×${map.height} · 유닛 ${map.events.length} · ${modeLabel} 모드`,
            }),
          ],
        }),
        el("div", {
          class: "ai-sel-actions",
          children: [
            el("button", {
              class: "ai-sel-btn",
              text: "⚙ 설정",
              attrs: { type: "button", title: "맵 설정" },
              dataset: { testid: "ai-ctx-map-settings" },
              on: { click: () => openMapPropertiesDialog(map.id, map.name) },
            }),
          ],
        }),
      );
      return;
    }

    strip.dataset.contextKind = "empty";
    strip.append(
      el("div", {
        class: "ai-sel-meta",
        children: [
          el("div", { class: "ai-sel-name", text: "선택된 맵 없음" }),
          el("div", { class: "ai-sel-sub", text: "맵을 선택하면 컨텍스트가 표시됩니다" }),
        ],
      }),
    );
  };

  const onTeamWingState = (e: Event): void => {
    const detail = (e as CustomEvent<AiTeamWingPillState>).detail;
    if (!detail) return;
    teamPillState = detail;
    const { event } = resolveContext(store.getCurrent(), editorState.get());
    syncPillBadge(event ? eventDisplayName(event) : null);
  };

  aiPanel.addEventListener("oprn:ai-panel-collapse", syncPillVisibility);
  window.addEventListener(AI_TEAM_WING_STATE_EVENT, onTeamWingState);
  const classObserver = typeof MutationObserver === "function"
    ? new MutationObserver(() => syncPillVisibility())
    : null;
  classObserver?.observe(aiPanel, { attributes: true, attributeFilter: ["class"] });

  const unsubEditor = editorState.subscribe(() => paint());
  const unsubStore = store.subscribe(() => paint());

  syncPillVisibility();
  paint();

  return () => {
    aiPanel.removeEventListener("oprn:ai-panel-collapse", syncPillVisibility);
    window.removeEventListener(AI_TEAM_WING_STATE_EVENT, onTeamWingState);
    classObserver?.disconnect();
    unsubEditor();
    unsubStore();
    strip.remove();
    pill.remove();
  };
}

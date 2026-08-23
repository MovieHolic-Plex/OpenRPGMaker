// Ctrl+K 통합 커맨드 팔레트 — 에디터 명령 + 맵 이동 + 스킬 (스펙 §4 3-A).
// 기존 스킬 팔레트(ai-skill-palette-*) 셸 클래스를 재사용하고 ↑↓/Enter 탐색을 더한다.
import { filterSkills, type SkillDef } from "@/ai/skills";
import { listEditorCommands, listMapCommands, matchEditorCommands, type EditorCommand } from "@/editor/commandRegistry";
import { store } from "@/project/store";
import { el } from "@/util/dom";

/**
 * 팔레트 열기 요청 이벤트. 팔레트는 스킬 실행기(aiChatPanel 의 drawer)를 필요로 하므로
 * 여는 주체는 늘 그 패널이다 — 탑바 칩처럼 밖에서 열고 싶을 때 이 이벤트를 쏜다.
 */
export const COMMAND_PALETTE_OPEN_EVENT = "oprn:open-command-palette";

/** 어디서든 커맨드 팔레트를 요청한다. 수신자(AI 패널)가 없으면 조용히 무시된다. */
export function requestCommandPalette(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT));
}

export interface PaletteEntry {
  readonly kind: "command" | "map" | "skill";
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly hotkey?: string;
  readonly run: () => void;
}

const KIND_CAPS = { command: 6, map: 4, skill: 6 } as const;
const KIND_HEADERS: Record<PaletteEntry["kind"], string> = { command: "명령", map: "맵 이동", skill: "스킬" };

export interface PaletteEntryDeps {
  readonly commands: readonly EditorCommand[];
  readonly maps: readonly EditorCommand[];
  readonly skills: readonly SkillDef[];
  readonly runSkill: (skill: SkillDef) => void;
}

export function buildPaletteEntries(query: string, deps: PaletteEntryDeps): readonly PaletteEntry[] {
  const commandHits = matchEditorCommands(query, deps.commands).slice(0, KIND_CAPS.command);
  const mapHits = matchEditorCommands(query, deps.maps).slice(0, KIND_CAPS.map);
  const q = query.trim().toLowerCase();
  const skillHits = deps.skills
    .filter((skill) => !q || skill.name.toLowerCase().includes(q) || skill.description.toLowerCase().includes(q))
    .slice(0, KIND_CAPS.skill);
  return [
    ...commandHits.map((command): PaletteEntry => ({
      kind: "command", id: command.id, label: command.label, detail: command.category, hotkey: command.hotkey, run: command.run,
    })),
    ...mapHits.map((command): PaletteEntry => ({
      kind: "map", id: command.id, label: command.label, detail: "이동", run: command.run,
    })),
    ...skillHits.map((skill): PaletteEntry => ({
      kind: "skill", id: skill.id, label: `${skill.icon} ${skill.name}`, detail: skill.description,
      run: () => deps.runSkill(skill),
    })),
  ];
}

export function movePaletteIndex(length: number, index: number, delta: 1 | -1): number {
  if (length <= 0) return 0;
  return (index + delta + length) % length;
}

export function openCommandPalette(options: { readonly runSkill: (skill: SkillDef) => void }): HTMLElement {
  document.querySelector("[data-testid='command-palette']")?.remove();
  const listHost = el("div", { class: "ai-skill-palette-list command-palette-list" });
  const search = el("input", {
    class: "ai-skill-param-input",
    attrs: { type: "text", placeholder: "명령·맵·스킬 검색… (↑↓ 이동, Enter 실행, Esc 닫기)" },
    dataset: { testid: "command-palette-search" },
  }) as HTMLInputElement;

  const backdrop = el("div", {
    class: "ai-skill-palette-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "command-palette" },
    children: [
      el("section", {
        class: "ai-skill-palette-window command-palette-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "커맨드 팔레트" },
        children: [search, listHost],
      }),
    ],
  });

  let entries: readonly PaletteEntry[] = [];
  let activeIndex = 0;
  const close = (): void => backdrop.remove();
  const runEntry = (entry: PaletteEntry): void => {
    close();
    entry.run();
  };

  const refresh = (): void => {
    entries = buildPaletteEntries(search.value, {
      commands: listEditorCommands(),
      maps: listMapCommands(store.getCurrent()),
      skills: filterSkills(search.value ? `/${search.value}` : "/"),
      runSkill: options.runSkill,
    });
    activeIndex = Math.min(activeIndex, Math.max(0, entries.length - 1));
    const nodes: HTMLElement[] = [];
    let lastKind: PaletteEntry["kind"] | null = null;
    entries.forEach((entry, index) => {
      if (entry.kind !== lastKind) {
        lastKind = entry.kind;
        nodes.push(el("div", { class: "command-palette-group", text: KIND_HEADERS[entry.kind] }));
      }
      nodes.push(
        el("button", {
          class: `ai-slash-item command-palette-item${index === activeIndex ? " is-active" : ""}`,
          attrs: { type: "button", title: entry.detail, "aria-selected": String(index === activeIndex) },
          dataset: { testid: `command-palette-item-${entry.kind}-${entry.id}` },
          children: [
            el("span", { class: "ai-slash-item-name", text: entry.label }),
            el("span", { class: "ai-slash-item-desc", text: entry.detail }),
            ...(entry.hotkey ? [el("span", { class: "command-palette-hotkey", text: entry.hotkey })] : []),
          ],
          on: { click: () => runEntry(entry) },
        }),
      );
    });
    if (entries.length === 0) nodes.push(el("div", { class: "ai-slash-empty", text: "일치하는 항목이 없습니다" }));
    listHost.replaceChildren(...nodes);
  };

  search.addEventListener("input", () => { activeIndex = 0; refresh(); });
  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { close(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = movePaletteIndex(entries.length, activeIndex, event.key === "ArrowDown" ? 1 : -1);
      refresh();
      return;
    }
    if (event.key === "Enter") {
      const entry = entries[activeIndex];
      if (entry) runEntry(entry);
    }
  });
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });

  refresh();
  document.body.append(backdrop);
  search.focus();
  return backdrop;
}

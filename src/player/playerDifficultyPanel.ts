// 새 게임 난이도 선택 창 — 불러오기 창(playerLoadPanel)과 같은 껍데기 클래스를 써서 타이틀 위에 뜬다.
// 선택은 player.ts 가 소유한다: 여기서는 버튼을 그리고 고른 id 만 넘긴다.
import { applyTitleScreenBackground } from "@/player/systemGraphics";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import type { DifficultyRecord, Project } from "@/project/types";
import { el } from "@/util/dom";

type DifficultyPanelOptions = {
  readonly project: Project;
  readonly difficulties: readonly DifficultyRecord[];
  readonly selectedId?: string;
  readonly onPick: (difficultyId: string) => void;
  readonly onBack: () => void;
};

export function renderDifficultyPanel(options: DifficultyPanelOptions): HTMLElement {
  const panel = el("div", {
    class: "title-screen rm-title-screen oprn-load-panel system-panel",
    dataset: { testid: "title-screen", screen: "difficulty" },
  });
  const settings = options.project.system.titleScreen ?? defaultTitleScreenSettings();
  applyTitleScreenBackground(panel, settings.backgroundResourceId ?? options.project.system.titleResourceId);
  const window = el("section", {
    class: "oprn-load-window",
    attrs: { "aria-label": "난이도 선택" },
    dataset: { testid: "player-difficulty-window", playInputOwner: "title-controls" },
  });
  window.append(el("h2", { class: "oprn-load-title", text: "난이도" }));
  const list = el("div", { class: "oprn-load-slots", dataset: { testid: "player-difficulty-list" } });
  for (const row of options.difficulties) {
    list.append(el("button", {
      class: "oprn-load-slot system-shell-button",
      text: row.name,
      attrs: { type: "button", ...(row.id === options.selectedId ? { "aria-current": "true" } : {}) },
      dataset: { testid: `difficulty-option-${row.id}`, difficultyId: row.id },
      on: { click: () => options.onPick(row.id) },
    }));
  }
  window.append(
    list,
    el("button", {
      class: "oprn-load-back system-shell-button",
      text: "뒤로",
      attrs: { type: "button" },
      dataset: { testid: "player-difficulty-back" },
      on: { click: options.onBack },
    }),
  );
  panel.append(window);
  return panel;
}

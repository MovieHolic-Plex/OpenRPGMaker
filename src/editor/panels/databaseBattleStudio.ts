import { switchDatabaseActiveTab, type DatabaseTab } from "@/editor/panels/database";
import { databasePanelRootFrom } from "@/editor/panels/databaseLifeUi";
import { makeDatabaseTabIcon } from "@/editor/panels/databaseTabIcons";
import { el } from "@/util/dom";

export type BattleStudioTab = "animations" | "battleScreen" | "battleCommands" | "terrain";

const BATTLE_STUDIO_TABS: readonly { readonly id: BattleStudioTab; readonly label: string }[] = [
  { id: "animations", label: "애니메이션" },
  { id: "battleScreen", label: "전투 화면" },
  { id: "battleCommands", label: "전투 명령" },
  { id: "terrain", label: "지형" },
];

export function battleStudioNav(active: BattleStudioTab): HTMLElement {
  return el("nav", {
    class: "db-battle-studio-nav",
    attrs: { "aria-label": "전투 스튜디오" },
    dataset: { testid: "db-battle-studio-nav" },
    children: BATTLE_STUDIO_TABS.map(({ id, label }) => battleStudioNavButton(id, label, active)),
  });
}

export function battleStudioHeading(active: BattleStudioTab, title: string, _description: string): HTMLElement {
  return el("header", {
    class: "db-battle-studio-heading",
    children: [
      el("div", {
        class: "db-battle-studio-title-block",
        children: [el("h3", { text: title })],
      }),
      battleStudioNav(active),
    ],
  });
}

function battleStudioNavButton(id: BattleStudioTab, label: string, active: BattleStudioTab): HTMLElement {
  const isActive = id === active;
  return el("button", {
    class: `db-battle-studio-nav-button${isActive ? " active" : ""}`,
    attrs: {
      type: "button",
      ...(isActive ? { "aria-current": "page" } : {}),
    },
    dataset: { testid: `db-battle-studio-nav-${id}` },
    children: [makeDatabaseTabIcon(id as DatabaseTab), el("span", { text: label })],
    on: {
      click: (event) => {
        if (isActive) return;
        const panelRoot = databasePanelRootFrom(event.currentTarget as HTMLElement | null);
        if (panelRoot) switchDatabaseActiveTab(id as DatabaseTab, panelRoot);
      },
    },
  });
}

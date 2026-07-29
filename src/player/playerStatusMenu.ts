import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { Project } from "@/project/types";
import {
  createPlayerStatusMenuSnapshot,
  type PlayerStatusMenuPartyRow,
  type PlayerStatusMenuSnapshot,
  type StatusMenuCommand,
  type StatusMenuCommandId,
} from "@/player/playerStatusMenuModel";
import { createStatusMenuDetail, type StatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { renderStatusMenuDetailPanel } from "@/player/playerStatusMenuDetailRenderer";
import { applySystemGraphic } from "@/player/systemGraphics";
import type { PlayerStatusMenuActions, PlayerStatusMenuOptions } from "@/player/playerStatusMenuTypes";
import { el } from "@/util/dom";

export {
  createPlayerStatusMenuSnapshot,
  listStatusMenuCommandIds,
  STATUS_MENU_COMMAND_IDS,
  statusMenuCommandLabel,
} from "@/player/playerStatusMenuModel";
export type { StatusMenuCommandId } from "@/player/playerStatusMenuModel";

export function renderPlayerStatusMenu(options: PlayerStatusMenuOptions): HTMLElement {
  const selectedCommand = options.selectedCommand ?? "items";
  const mode = options.mode ?? "main";
  const waitModeEnabled = options.waitModeEnabled ?? true;
  const snapshot = createPlayerStatusMenuSnapshot(options.project, options.session, {
    elapsedMs: options.elapsedMs,
    waitModeEnabled,
  });
  const panel = el("div", {
    class: "main-menu rm2k3-status-menu system-panel",
    attrs: {
      "aria-label": "RPG Maker 2003 player status menu",
      role: "dialog",
    },
    dataset: { testid: "main-menu", statusMenuScreen: mode },
  });
  applySystemGraphic(panel);

  if (mode === "function") panel.classList.add("status-menu-detail-focus");
  const detail = createStatusMenuDetail({
    project: options.project,
    session: options.session,
    selectedCommand,
    slots: options.slots,
    waitModeEnabled,
    targetItemId: options.targetItemId,
    skillActorId: options.skillActorId,
    selectedSkillId: options.selectedSkillId,
    equipmentActorId: options.equipmentActorId,
    equipmentSlotId: options.equipmentSlotId,
    formationActorId: options.formationActorId,
    monsterView: options.monsterView,
    confirmSaveSlot: options.confirmSaveSlot,
    saveEnabled: options.saveEnabled,
    onSaveSlot: options.actions.onSaveSlot,
    onLoadSlot: options.actions.onLoadSlot,
    onSelectItemTarget: options.actions.onSelectItemTarget,
    onUseItem: options.actions.onUseItem,
    onSelectSkillActor: options.actions.onSelectSkillActor,
    onSelectSkill: options.actions.onSelectSkill,
    onSelectEquipmentActor: options.actions.onSelectEquipmentActor,
    onSelectEquipmentSlot: options.actions.onSelectEquipmentSlot,
    onEquipItem: options.actions.onEquipItem,
    onUnequipItem: options.actions.onUnequipItem,
    onToggleRow: options.actions.onToggleRow,
    onSelectFormationActor: options.actions.onSelectFormationActor,
    onMoveFormationActor: options.actions.onMoveFormationActor,
    onToggleMonsterView: options.actions.onToggleMonsterView,
    onMoveMonster: options.actions.onMoveMonster,
  });
  panel.append(
    renderCommandRail({ snapshot, selectedCommand, actions: options.actions }),
    renderStatusMenuBody({
      project: options.project,
      snapshot,
      detail,
      selectedDetailActionIndex: options.selectedDetailActionIndex,
    }),
    renderFooter(snapshot, options.message)
  );
  panel.append(statusMenuDebug(selectedCommand, mode));
  return panel;
}

type CommandRailRenderOptions = {
  readonly snapshot: PlayerStatusMenuSnapshot;
  readonly selectedCommand: StatusMenuCommandId;
  readonly actions: PlayerStatusMenuActions;
};

function renderCommandRail(options: CommandRailRenderOptions): HTMLElement {
  const rail = el("nav", {
    class: "status-menu-command-rail",
    attrs: { role: "menu" },
    dataset: { testid: "status-menu-command-rail" },
  });
  for (const command of options.snapshot.commands) {
    const button = el("button", {
      class: "status-menu-command",
      text: command.label,
      attrs: { role: "menuitem" },
      dataset: { testid: `status-menu-command-${command.id}` },
      on: { click: () => runCommand(command, options.actions) },
    });
    if (command.id === options.selectedCommand) button.classList.add("selected");
    rail.append(button);
  }
  return rail;
}

function runCommand(command: StatusMenuCommand, actions: PlayerStatusMenuActions): void {
  switch (command.id) {
    case "wait":
      actions.onToggleWait();
      return;
    case "to-title":
      actions.onToTitle();
      return;
    case "items":
    case "skills":
    case "equipment":
    case "monsters":
    case "save":
    case "load":
    case "status":
    case "row":
    case "formation":
    case "quests":
    case "relationships":
      actions.onCommand(command.id);
      return;
    default:
      assertNever(command.id);
  }
}

function renderStatusMenuBody(options: {
  readonly project: Project;
  readonly snapshot: PlayerStatusMenuSnapshot;
  readonly detail: StatusMenuDetail;
  readonly selectedDetailActionIndex?: number;
}): HTMLElement {
  return el("div", {
    class: "status-menu-body",
    children: [
      renderPartyPanel(options.project, options.snapshot),
      renderStatusMenuDetailPanel(options.project, options.detail, { selectedActionIndex: options.selectedDetailActionIndex }),
    ],
    dataset: { testid: "status-menu-body" },
  });
}

function renderPartyPanel(project: Project, snapshot: PlayerStatusMenuSnapshot): HTMLElement {
  const party = el("section", {
    class: "status-menu-party",
    dataset: { testid: "status-menu-party" },
  });
  if (snapshot.emptyPartyLabel) {
    party.append(el("div", {
      class: "status-menu-empty",
      text: snapshot.emptyPartyLabel,
      dataset: { testid: "status-menu-empty" },
    }));
    return party;
  }
  snapshot.partyRows.forEach((row, index) => {
    party.append(renderPartyRow(project, row, index));
  });
  return party;
}

function renderPartyRow(project: Project, row: PlayerStatusMenuPartyRow, index: number): HTMLElement {
  const info = el("div", { class: "status-menu-party-info" });
  info.append(
    el("div", { class: "status-menu-actor-name", text: row.name }),
    el("div", { class: "status-menu-actor-subline", text: `${row.levelLabel}  ${row.condition}` }),
    el("div", { class: "status-menu-actor-vitals", text: row.hpLabel }),
    el("div", { class: "status-menu-actor-vitals", text: row.mpLabel })
  );
  return el("article", {
    class: "status-menu-party-row",
    children: [renderFace(project, row, index), info],
    dataset: { testid: `status-menu-party-row-${index}` },
  });
}

function renderFace(project: Project, row: PlayerStatusMenuPartyRow, index: number): HTMLElement {
  const url = resolveAssetResourceUrl(row.faceResourceId, { project });
  if (!url) {
    return el("div", {
      class: "status-menu-face missing",
      text: "Face",
      attrs: { role: "img", "aria-label": `${row.name} face missing` },
      dataset: { testid: `status-menu-face-${index}` },
    });
  }
  return el("div", {
    class: "status-menu-face actor-sheet-crop",
    attrs: {
      role: "img",
      "aria-label": `${row.name} face`,
      style: [
        `--crop-url:url("${url}")`,
        "--crop-width:44px",
        "--crop-height:44px",
        "--crop-sheet-width:176px",
        "--crop-sheet-height:176px",
        "--crop-x:0px",
        "--crop-y:0px",
      ].join(";"),
    },
    dataset: { testid: `status-menu-face-${index}` },
  });
}

function renderFooter(
  snapshot: PlayerStatusMenuSnapshot,
  message: string | undefined
): HTMLElement {
  const footer = el("footer", { class: "status-menu-footer" });
  // 돈·시간·안내를 한 덩어리로 몰아두면 "돈 0G 0:00" 처럼 붙어 읽힌다.
  // 돈은 왼쪽, 플레이 시간은 오른쪽 끝, 안내 문구는 가운데로 갈라 놓는다.
  footer.append(el("span", {
    class: "status-menu-gold",
    text: snapshot.goldLabel,
    attrs: { title: snapshot.goldLabel },
    dataset: { testid: "status-menu-gold" },
  }));
  footer.append(el("div", {
    class: "status-menu-message",
    text: message ?? "",
    attrs: { role: "status" },
    dataset: { testid: "status-menu-message" },
  }));
  footer.append(el("span", {
    class: "status-menu-time",
    text: snapshot.timeLabel,
    dataset: { testid: "status-menu-time" },
  }));
  return footer;
}

function statusMenuDebug(selectedCommand: StatusMenuCommandId, mode: "function" | "main"): HTMLElement {
  return el("script", {
    text: JSON.stringify({ selectedCommand, mode }),
    attrs: { type: "application/json" },
    dataset: { testid: "status-menu-debug-json" },
  });
}

function assertNever(value: never): never {
  throw new Error(`Unhandled status menu command: ${String(value)}`);
}

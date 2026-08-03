import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { Project } from "@/project/types";
import {
  createPlayerStatusMenuSnapshot,
  statusMenuCommandGroupLabel,
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
    // 명시 메시지가 없으면 커서가 올라간 항목의 설명을 푸터에 띄운다(리스트 행은 1줄로 압축됨).
    renderFooter(snapshot, options.message ?? selectedEntryDescription(detail, options.selectedDetailActionIndex))
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
    // 그룹 라벨은 role=menu 의 자식이지만 menuitem 이 아니다(커서가 멈추지 않음).
    // 커서 이동은 snapshot.commands 배열 순서를 쓰므로 라벨 노드는 내비게이션에 영향이 없다.
    if (command.groupStart) {
      rail.append(el("div", {
        class: "status-menu-command-group-label",
        text: statusMenuCommandGroupLabel(command.groupId),
        attrs: { "aria-hidden": "true" },
        dataset: { testid: `status-menu-command-group-${command.groupId}` },
      }));
    }
    const button = el("button", {
      class: "status-menu-command",
      text: command.label,
      attrs: { role: "menuitem" },
      dataset: { testid: `status-menu-command-${command.id}` },
      on: { click: () => runCommand(command, options.actions) },
    });
    if (command.destructive) button.classList.add("destructive");
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
  // 숫자 라벨은 유지한다 — 정확한 값은 숫자가, 파티 전체 판독은 게이지가 담당한다.
  // 파티 열은 120px(논리) 폭 · 4명 고정 높이라 세로도 가로도 여유가 없다. 실측한 실패들:
  //   게이지를 별도 행으로 추가 → 4명 × 6행이 패널 높이를 넘겨 텍스트 16개가 세로로 잘림.
  //   숫자와 게이지를 같은 행에 나란히 → 숫자 칼럼이 0 까지 밀려 가로로 잘림.
  // 그래서 (a) 게이지를 숫자 행의 **배경**으로 깔고, (b) 이름 행과 레벨 행을 합쳐 4행 → 3행으로
  // 줄였다. 남은 여유로 line-height 를 글리프가 들어가는 값까지 올릴 수 있다 — 기존 1.02 는
  // 9px 글리프 박스(11px)를 담지 못해 이름/레벨/HP/MP 가 상시 2px 잘려 있었다(baseline 실측).
  // 합치면서 condition 은 빠졌다. 지금 값은 하드코딩 "정상" 이라 4번 반복돼도 정보량이 0 이고,
  // 실제 상태 이상이 붙으면 그때 상태 화면이 맡는 편이 맞다.
  info.append(
    el("div", {
      class: "status-menu-party-headline",
      children: [
        el("span", { class: "status-menu-actor-name", text: row.name }),
        el("span", { class: "status-menu-actor-subline", text: row.levelLabel }),
      ],
    }),
    renderVitalLine(row.hpLabel, row.hpRatio, `hp ${row.hpLevel}`, `status-menu-hp-gauge-${index}`),
    renderVitalLine(row.mpLabel, row.mpRatio, "mp", `status-menu-mp-gauge-${index}`)
  );
  return el("article", {
    class: "status-menu-party-row",
    children: [renderFace(project, row, index), info],
    dataset: { testid: `status-menu-party-row-${index}` },
  });
}

function renderVitalLine(label: string, ratio: number, variant: string, testId: string): HTMLElement {
  return el("div", {
    class: "status-menu-vital-line",
    children: [
      el("span", { class: "status-menu-actor-vitals", text: label }),
      renderVitalGauge(ratio, variant, testId),
    ],
  });
}

function renderVitalGauge(ratio: number, variant: string, testId: string): HTMLElement {
  const percent = `${Math.round(ratio * 1000) / 10}%`;
  return el("div", {
    class: `status-menu-vital-gauge ${variant}`,
    attrs: {
      role: "meter",
      "aria-valuemin": "0",
      "aria-valuemax": "100",
      "aria-valuenow": String(Math.round(ratio * 100)),
    },
    dataset: { testid: testId },
    children: [el("span", {
      class: "status-menu-vital-gauge-fill",
      attrs: { style: `width:${percent}` },
    })],
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

/** 상세 패널의 actionIndex 배정 규칙(renderStatusMenuDetailPanel)과 같은 순서로 세어
    커서가 올라간 조작 가능 항목의 설명을 찾는다. */
function selectedEntryDescription(detail: StatusMenuDetail, selectedActionIndex: number | undefined): string | undefined {
  if (selectedActionIndex === undefined) return undefined;
  let actionIndex = 0;
  for (const entry of detail.entries) {
    if (!entry.onActivate || entry.disabled) continue;
    if (actionIndex === selectedActionIndex) return entry.description;
    actionIndex += 1;
  }
  return undefined;
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

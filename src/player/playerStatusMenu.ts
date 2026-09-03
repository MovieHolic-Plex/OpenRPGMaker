import {
  createPlayerStatusMenuSnapshot,
  isStatusMenuGroupEntryId,
  statusMenuCommandGroupLabel,
  statusMenuRailIdForCommand,
  type StatusMenuCommandId,
  type StatusMenuGroupEntryId,
  type StatusMenuRailId,
  type PlayerStatusMenuPartyRow,
  type PlayerStatusMenuSnapshot,
  type StatusMenuCommand,
} from "@/player/playerStatusMenuModel";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createStatusMenuDetail, type StatusMenuDetail, type StatusMenuStatDelta } from "@/player/playerStatusMenuDetails";
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
    class: "main-menu oprn-status-menu system-panel",
    attrs: {
      "aria-label": "플레이어 상태 메뉴",
      "aria-modal": "true",
      role: "dialog",
    },
    dataset: { testid: "main-menu", statusMenuScreen: mode, statusMenuLayout: "edge-dock" },
  });
  applySystemGraphic(panel);
  // The modern ESC surface keeps the authored system resource metadata and the
  // windowskin reachable via --runtime-window-skin, but deliberately strips only
  // the border-image frame so the full-stage panel never floods the screen with the
  // skin's center tile ("fill"). Inner panels still consume the authored skin.
  panel.style.removeProperty("border-image-source");
  panel.style.removeProperty("border-image-slice");

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
    lifeLedgerTab: options.lifeLedgerTab,
    confirmSaveSlot: options.confirmSaveSlot,
    confirmToTitle: options.confirmToTitle,
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
    onReplacePendingMonsterSkill: options.actions.onReplacePendingMonsterSkill,
    onRejectPendingMonsterSkill: options.actions.onRejectPendingMonsterSkill,
    onSelectLifeLedgerTab: options.actions.onSelectLifeLedgerTab,
    onLifeLedgerMutation: options.actions.onLifeLedgerMutation,
    onCommand: options.actions.onCommand,
  });
  const detailPanel = renderStatusMenuDetailPanel(options.project, detail, {
    selectedActionIndex: options.selectedDetailActionIndex,
    // 쇼케이스는 작업 패널에서만 — 트레이·확인 카드는 명령 버튼 목록이라 그릴 그림이 없다.
    showcase: selectedCommand !== "to-title" && !isStatusMenuGroupEntryId(selectedCommand),
  });
  detailPanel.dataset.statusMenuPresentation = selectedCommand === "to-title"
    ? "confirmation-card"
    : isStatusMenuGroupEntryId(selectedCommand)
      ? "context-tray"
      : "work-panel";
  detailPanel.dataset.statusMenuCommand = selectedCommand;
  if (mode === "main") {
    detailPanel.setAttribute("aria-hidden", "true");
    detailPanel.setAttribute("inert", "");
  }
  panel.append(
    // B안 2열: 좌측 한 창에 레일 + 파티, 우측 전체가 작업 영역.
    el("div", {
      class: "status-menu-sidebar",
      dataset: { testid: "status-menu-sidebar" },
      children: [
        renderCommandRail({ snapshot, selectedCommand, actions: options.actions }),
        // 장비 후보를 고르는 중이면 파티 대신 "변화" 를 띄운다. 둘 다 넣으면 사이드바를 넘기고,
        // 그 순간 알고 싶은 건 파티 HP 가 아니라 "이걸 끼면 뭐가 얼마나 바뀌나" 다.
        renderStatDeltaPanel(selectedEntryStatDelta(detail, options.selectedDetailActionIndex))
          ?? renderPartyPanel(options.project, snapshot),
      ],
    }),
    detailPanel,
    // 명시 메시지가 없으면 커서가 올라간 항목의 설명을 푸터에 띄운다(리스트 행은 1줄로 압축됨).
    // main 모드에선 상세 패널이 visibility:hidden 이라 커서가 화면에 없다 — 안 보이는 항목의
    // 설명을 푸터에 띄우면 레일 선택(예: 시스템)과 어긋난 문구("…슬롯에 저장합니다")가 남는다.
    renderFooter(
      snapshot,
      options.message ?? (mode === "function"
        ? selectedEntryDescription(detail, options.selectedDetailActionIndex) ?? interactiveHint(detail)
        : undefined)
    )
  );
  panel.append(statusMenuDebug(selectedCommand, mode));
  return panel;
}

type CommandRailRenderOptions = {
  readonly snapshot: PlayerStatusMenuSnapshot;
  readonly selectedCommand: StatusMenuRailId;
  readonly actions: PlayerStatusMenuActions;
};

function renderCommandRail(options: CommandRailRenderOptions): HTMLElement {
  const selectedRailId = statusMenuRailIdForCommand(options.selectedCommand);
  const rail = el("nav", {
    class: "status-menu-command-rail status-menu-primary-dock",
    attrs: {
      role: "menu",
      "aria-label": "게임 메뉴",
      tabindex: "0",
      "aria-activedescendant": `status-menu-command-${selectedRailId}`,
    },
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
    const label = command.label.replace(/\s*▸\s*$/u, "");
    const selected = command.id === selectedRailId;
    const button = el("button", {
      class: "status-menu-command",
      attrs: {
        id: `status-menu-command-${command.id}`,
        role: "menuitem",
        "aria-label": label,
        "aria-current": selected ? "true" : "false",
        tabindex: selected ? "0" : "-1",
      },
      dataset: { testid: `status-menu-command-${command.id}` },
      children: [
        el("span", {
          class: "status-menu-command-icon",
          attrs: { "aria-hidden": "true" },
          dataset: {
            testid: `status-menu-command-icon-${command.id}`,
            icon: statusMenuCommandIcon(command.id),
          },
        }),
        el("span", { class: "status-menu-command-label", text: label }),
        ...(command.opensGroup
          ? [el("span", { class: "status-menu-command-legacy-suffix", text: " ▸", attrs: { "aria-hidden": "true" } })]
          : []),
      ],
      on: { click: () => runCommand(command, options.actions) },
    });
    if (command.destructive) button.classList.add("destructive");
    if (selected) button.classList.add("selected");
    rail.append(button);
  }
  return rail;
}

function statusMenuCommandIcon(commandId: StatusMenuRailId): string {
  switch (commandId) {
    case "items": return "◇";
    case "skills": return "✦";
    case "equipment": return "◈";
    case "party-menu": return "●●";
    case "record-menu": return "▤";
    case "system-menu": return "⚙";
    case "status": return "○";
    case "row": return "↔";
    case "formation": return "◆";
    case "monsters": return "♢";
    case "quests": return "✓";
    case "relationships": return "∞";
    case "life-ledger": return "▦";
    case "save": return "↓";
    case "load": return "↑";
    case "wait": return "Ⅱ";
    case "to-title": return "⌂";
  }
  return assertNever(commandId);
}

function runCommand(command: StatusMenuCommand, actions: PlayerStatusMenuActions): void {
  // 접힌 그룹 열기 — 기능 실행이 아니라 작업 영역에 그 그룹의 명령 목록을 띄운다.
  if (command.opensGroup) {
    actions.onOpenGroup(command.id as StatusMenuGroupEntryId);
    return;
  }
  switch (command.id as StatusMenuCommandId) {
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
    case "life-ledger":
      actions.onCommand(command.id as StatusMenuCommandId);
      return;
    default:
      assertNever(command.id as never);
  }
}

function renderPartyPanel(project: PlayerStatusMenuOptions["project"], snapshot: PlayerStatusMenuSnapshot): HTMLElement {
  const party = el("section", {
    class: "status-menu-party status-menu-party-glance",
    attrs: { "aria-label": "파티 상태" },
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

function renderPartyRow(
  project: PlayerStatusMenuOptions["project"],
  row: PlayerStatusMenuPartyRow,
  index: number,
): HTMLElement {
  // 사이드바 가용 높이(약 175px)에서 레일이 75px 를 쓰고 파티에 남는 건 100px 이다.
  // 1열 × 4명으로 HP/MP 두 줄을 넣으면 명당 34px = 136px 로 넘친다(실측: 뒤 2명이 잘림).
  // 2×2 격자로 두면 2행 × 34px = 69px 로 들어간다. 대신 셀 폭이 52px 라 얼굴은 뺐다 —
  // 좁은 셀에서 얼굴은 숫자 자리를 먹기만 하고, 어차피 이름이 더 빨리 읽힌다.
  const info = el("div", { class: "status-menu-party-info" });
  info.append(
    el("div", {
      class: "status-menu-party-headline",
      children: [
        el("span", { class: "status-menu-actor-name", text: row.name }),
        el("span", { class: "status-menu-actor-subline", text: row.levelLabel }),
      ],
    }),
    renderVitalLine(row.hpValueLabel, row.hpRatio, `hp ${row.hpLevel}`, `status-menu-hp-gauge-${index}`),
    renderVitalLine(row.mpValueLabel, row.mpRatio, "mp", `status-menu-mp-gauge-${index}`)
  );
  return el("article", {
    class: "status-menu-party-row",
    children: [renderPartyFace(project, row, index), info],
    attrs: { "aria-label": `${row.name} ${row.levelLabel} ${row.hpLabel} ${row.mpLabel}` },
    dataset: { testid: `status-menu-party-row-${index}` },
  });
}

function renderPartyFace(
  project: PlayerStatusMenuOptions["project"],
  row: PlayerStatusMenuPartyRow,
  index: number,
): HTMLElement {
  // 파티 얼굴 상자는 22×22px 로 그린다. 얼굴은 낱장 파일(48×48) 한 장이므로
  // 상자 크기로 축소해 통째로 건다 — 시트 열/행 계산은 없다.
  // 그리는 기하를 인라인으로 잡는다 — 예전 `.actor-sheet-crop` 공용 생상은 진짜 시트(charset)
  // 후손이라 얼굴은 이제 그 생상을 실지 않는다.
  const boxSize = 22;
  const url = resolveAssetResourceUrl(row.faceResourceId, { project });
  if (!url) {
    return el("span", {
      class: "status-menu-face missing",
      text: row.name.trim().slice(0, 1),
      attrs: { role: "img", "aria-label": row.name },
      dataset: { testid: `status-menu-face-${index}` },
    });
  }
  return el("span", {
    class: "status-menu-face",
    attrs: {
      role: "img",
      "aria-label": row.name,
      style: [
        `background-image:url("${url}")`,
        `background-size:${boxSize}px ${boxSize}px`,
        "background-repeat:no-repeat",
        "image-rendering:pixelated",
        `width:${boxSize}px`,
        `height:${boxSize}px`,
      ].join(";"),
    },
    dataset: { testid: `status-menu-face-${index}` },
  });
}

/** 숫자 한 줄 + 그 줄을 덮는 게이지. 행도 폭도 늘지 않는다. */
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

/** 커서가 올라간 조작 가능 항목의 능력치 변화. 없으면 undefined. */
function selectedEntryStatDelta(
  detail: StatusMenuDetail,
  selectedActionIndex: number | undefined
): readonly StatusMenuStatDelta[] | undefined {
  if (selectedActionIndex === undefined) return undefined;
  let actionIndex = 0;
  for (const entry of detail.entries) {
    if (!entry.onActivate || entry.disabled) continue;
    if (actionIndex === selectedActionIndex) return entry.statDelta;
    actionIndex += 1;
  }
  return undefined;
}

function renderStatDeltaPanel(deltas: readonly StatusMenuStatDelta[] | undefined): HTMLElement | null {
  if (!deltas || deltas.length === 0) return null;
  const panel = el("section", {
    class: "status-menu-stat-delta",
    dataset: { testid: "status-menu-stat-delta" },
  });
  panel.append(el("div", { class: "status-menu-stat-delta-title", text: "변화" }));
  for (const delta of deltas) {
    const diff = delta.next - delta.current;
    const row = el("div", {
      class: `status-menu-stat-delta-row${diff > 0 ? " up" : diff < 0 ? " down" : ""}`,
      dataset: { testid: `status-menu-stat-delta-${delta.label}` },
    });
    row.append(el("span", { class: "status-menu-stat-delta-label", text: delta.label }));
    // 변하지 않는 값에는 화살표를 그리지 않는다 — 시선이 변화에만 가야 한다.
    row.append(el("span", {
      class: "status-menu-stat-delta-value",
      text: diff === 0
        ? String(delta.current)
        : `${delta.current} → ${delta.next} (${diff > 0 ? "+" : "−"}${Math.abs(diff)})`,
    }));
    panel.append(row);
  }
  return panel;
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

/** 조작 가능한 목록은 힌트 줄을 패널에 그리지 않으므로(renderStatusMenuDetailPanel) 푸터가 받아 쓴다.
    장비 슬롯처럼 행별 설명이 없는 화면에서는 이게 유일한 안내문이다. */
function interactiveHint(detail: StatusMenuDetail): string | undefined {
  if (detail.entries.length === 0) return undefined;
  return detail.entries.some((entry) => Boolean(entry.onActivate)) ? detail.hint : undefined;
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
    attrs: { "aria-label": snapshot.goldLabel },
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

function statusMenuDebug(selectedCommand: StatusMenuRailId, mode: "function" | "main"): HTMLElement {
  return el("script", {
    text: JSON.stringify({ selectedCommand, mode }),
    attrs: { type: "application/json" },
    dataset: { testid: "status-menu-debug-json" },
  });
}

function assertNever(value: never): never {
  throw new Error(`Unhandled status menu command: ${String(value)}`);
}

import {
  createPlayerStatusMenuSnapshot,
  isStatusMenuGroupEntryId,
  statusMenuCommandGroupLabel,
  statusMenuCommandSummary,
  statusMenuRailIdForCommand,
  type StatusMenuCommandId,
  type StatusMenuGroupEntryId,
  type StatusMenuRailId,
  type PlayerStatusMenuPartyRow,
  type PlayerStatusMenuSnapshot,
  type StatusMenuCommand,
} from "@/player/playerStatusMenuModel";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createStatusMenuDetail, type StatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { renderStatusMenuDetailPanel } from "@/player/playerStatusMenuDetailRenderer";
import { applySystemGraphic } from "@/player/systemGraphics";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { applyCharsetFrameCrop } from "@/assets/charsetFrameCrop";
import { resolvePlayerSpriteResource } from "@/player/playerSpriteResources";
import { resolveActorAppearance } from "@/project/characterAppearances";
import { menuSkinFor } from "@/player/menuSkins/registry";
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
  // 스킨(자료집 → 시스템 → 화면)은 DOM 골격을 바꾸지 않는다 — 루트 속성만 쓰고 CSS 가 배치·색·아이콘을 갈아입는다.
  // 렌더러가 갈라지는 곳은 첫 화면(landing)·사이드 파티·허브 요약뿐이다. 기본 workbench 는 지금 화면 그대로.
  const skin = menuSkinFor(options.project);
  const panel = el("div", {
    class: "main-menu oprn-status-menu system-panel",
    attrs: {
      "aria-label": "플레이어 상태 메뉴",
      "aria-modal": "true",
      role: "dialog",
    },
    dataset: {
      testid: "main-menu",
      statusMenuScreen: mode,
      statusMenuLayout: "workbench",
      menuSkin: skin.id,
      menuSkinTone: skin.tone,
      menuSkinLanding: skin.landing,
      menuSkinIcons: skin.railIcons,
      menuSkinRail: skin.railStyle,
    },
  });
  applySystemGraphic(panel);
  // Keep authored metadata while the shared runtime palette paints the menu.
  panel.style.removeProperty("border-image-source");
  panel.style.removeProperty("border-image-slice");

  if (mode === "function") panel.classList.add("status-menu-detail-focus");
  const detail = createStatusMenuDetail({
    project: options.project,
    session: options.session,
    selectedCommand,
    slots: options.slots,
    waitModeEnabled,
    inventoryView: options.inventoryView,
    onInventoryViewChange: options.actions.onInventoryViewChange,
    onOptionsChanged: options.actions.onOptionsChanged,
    targetItemId: options.targetItemId,
    skillActorId: options.skillActorId,
    selectedSkillId: options.selectedSkillId,
    growthTab: options.growthTab,
    onSelectGrowthTab: options.actions.onSelectGrowthTab,
    onGrowthMutation: options.actions.onGrowthMutation,
    equipmentActorId: options.equipmentActorId,
    equipmentSlotId: options.equipmentSlotId,
    formationActorId: options.formationActorId,
    battleReportIndex: options.battleReportIndex,
    onSelectBattleReport: options.actions.onSelectBattleReport,
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
    readLive: options.readLive,
    placementDirection: options.placementDirection,
    getPlacementDirection: options.getPlacementDirection,
    getScene: options.getScene,
    onCommand: options.actions.onCommand,
  });
  const presentation = selectedCommand === "to-title"
    ? "confirmation-card"
    : isStatusMenuGroupEntryId(selectedCommand)
      ? "context-tray"
      : "work-panel";
  // 사이드 파티(스킨 옵션)는 작업 패널에서만 — 트레이·확인 카드·대상 선택은 파티 정보를 따로 갖거나 필요 없다.
  // Effects, equipment comparisons and tabbed pages need the full detail layout.
  // Never hide decision-making information to make room for a second party view.
  const needsFullDetail = selectedCommand === "options" || selectedCommand === "items" || Boolean(detail.tabs?.length) || detail.entries.some((entry) => entry.statDelta || entry.facts?.length);
  const sideParty = skin.sideParty && !needsFullDetail && mode === "function" && presentation === "work-panel" && !options.targetItemId
    ? renderSidePartyMini(options.project, snapshot)
    : undefined;
  const detailPanel = renderStatusMenuDetailPanel(options.project, detail, {
    selectedActionIndex: options.selectedDetailActionIndex,
    // 쇼케이스는 작업 패널에서만 — 트레이·확인 카드는 명령 버튼 목록이라 그릴 그림이 없다.
    showcase: selectedCommand !== "options" && !options.targetItemId && presentation === "work-panel",
    side: sideParty,
  });
  detailPanel.dataset.statusMenuPresentation = presentation;
  detailPanel.dataset.statusMenuCommand = selectedCommand;
  // 첫 화면이 작업 패널이 아닌 스킨(파티 퍼스트·허브·시트)은 main 모드에서 작업 패널을 그리지 않는다.
  const landingOnly = mode === "main" && skin.landing !== "work";
  if (mode === "main") {
    detailPanel.setAttribute("inert", "");
  }
  const showParty = selectedCommand === "party-menu" && !landingOnly;
  panel.classList.toggle("has-party-overview", showParty);
  panel.append(
    el("header", {
      class: "status-menu-header",
      children: [
        el("span", { class: "status-menu-heading", text: "메뉴" }),
        el("span", { class: "status-menu-location", text: options.project.maps[options.session.currentMapId]?.name ?? "" }),
        el("span", { class: "status-menu-gold", text: snapshot.goldLabel, dataset: { testid: "status-menu-gold" } }),
        el("span", { class: "status-menu-time", text: snapshot.timeLabel, dataset: { testid: "status-menu-time" } }),
      ],
    }),
    el("div", {
      class: "status-menu-sidebar",
      dataset: { testid: "status-menu-sidebar" },
      children: [
        renderCommandRail({
          project: options.project,
          session: options.session,
          snapshot,
          selectedCommand,
          actions: options.actions,
          summaries: skin.landing === "hub" ? { slots: options.slots, waitModeEnabled } : undefined,
        }),
      ],
    }),
    ...(landingOnly
      ? [skin.landing === "hub"
          ? renderPartyStrip(options.project, snapshot)
          // 사이드 시트는 140px 폭에 4행이라 얼굴을 22px 로 줄인다(파티 퍼스트는 30px).
          : renderPartyOverview(options.project, snapshot, skin.landing === "sheet" ? 22 : 30, skin.partyArt === "character" ? options.session : undefined)]
      : [detailPanel]),
    ...(showParty ? [renderPartyPanel(options.project, snapshot)] : []),
    renderFooter(
      mode,
      options.message ?? (mode === "function"
        ? selectedEntryDescription(detail, options.selectedDetailActionIndex) ?? interactiveHint(detail)
        : selectedCommand === "items" ? "목록 끝에서 분류·정렬 변경 (본문에서 ↑ 두 번)" : undefined),
      skin.railColumns
    )
  );
  panel.append(statusMenuDebug(selectedCommand, mode));
  return panel;
}

type CommandRailRenderOptions = {
  readonly project: PlayerStatusMenuOptions["project"];
  readonly session: PlayerStatusMenuOptions["session"];
  readonly snapshot: PlayerStatusMenuSnapshot;
  readonly selectedCommand: StatusMenuRailId;
  readonly actions: PlayerStatusMenuActions;
  /** 허브 타일: 명령마다 한 줄 요약(몇 종·몇 명·하위 명령)을 라벨 아래에 단다. */
  readonly summaries?: { readonly slots: PlayerStatusMenuOptions["slots"]; readonly waitModeEnabled: boolean };
};

function renderCommandRail(options: CommandRailRenderOptions): HTMLElement {
  const selectedRailId = statusMenuRailIdForCommand(options.selectedCommand, options.project, options.session);
  const selectedRailIndex = Math.max(0, options.snapshot.commands.findIndex((command) => command.id === selectedRailId));
  const rail = el("nav", {
    class: "status-menu-command-rail status-menu-primary-dock",
    attrs: {
      role: "menu",
      "aria-label": "게임 메뉴",
      tabindex: "0",
      "aria-activedescendant": `status-menu-command-${selectedRailId}`,
      // y 픽셀은 workbench 행 간격(26px) 기준. 행 높이가 다른 스킨(평탄 레일)은 index 로 자기 간격을 곱한다.
      style: `--status-menu-cursor-y:${selectedRailIndex * 26}px;--status-menu-cursor-index:${selectedRailIndex}`,
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
            // 컬러 아이콘 스킨의 CSS 가 배경 이미지를 고르는 이름. 글리프(data-icon)는 기본 스킨용으로 남긴다.
            iconName: statusMenuCommandIconName(command.id),
          },
        }),
        el("span", { class: "status-menu-command-label", text: label }),
        ...(options.summaries
          ? [el("span", {
              class: "status-menu-command-summary",
              text: statusMenuCommandSummary(command.id, options.project, options.session, options.summaries.slots, options.summaries.waitModeEnabled),
              dataset: { testid: `status-menu-command-summary-${command.id}` },
            })]
          : []),
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
    case "options":
    case "system-menu": return "⚙";
    case "status": return "○";
    case "row": return "↔";
    case "formation": return "◆";
    case "monsters": return "♢";
    case "battle-reports": return "▤";
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

/** 컬러 아이콘 스킨의 아이콘 이름 — styles/runtime/statusMenuSkins.css 의 [data-icon-name] 규칙과 1:1.
    그림은 전투 HUD 가 이미 쓰는 starter battle-icon-* 와 CC0 아이템 아이콘(crystal·map·clock·gear…)이다. */
function statusMenuCommandIconName(commandId: StatusMenuRailId): string {
  switch (commandId) {
    case "items": return "bag";
    case "skills": return "fire";
    case "equipment": return "sword";
    case "party-menu": return "cross";
    case "record-menu": return "map";
    case "options":
    case "system-menu": return "gear";
    case "status": return "cross";
    case "row": return "next";
    case "formation": return "shield";
    case "monsters": return "shard";
    case "battle-reports": return "book-magic";
    case "quests": return "map";
    case "relationships": return "world";
    case "life-ledger": return "book-magic";
    case "save": return "crystal";
    case "load": return "warp-scroll";
    case "wait": return "clock";
    case "to-title": return "boot";
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
    case "options":
    case "items":
    case "skills":
    case "equipment":
    case "monsters":
    case "save":
    case "load":
    case "status":
    case "row":
    case "formation":
    case "battle-reports":
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
  // Party overview belongs to the party page; task pages own their target information.
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
  boxSize = 22,
  testId = `status-menu-face-${index}`,
): HTMLElement {
  // 파티 얼굴 상자는 기본 22×22px 로 그린다(파티 개요 30px · 사이드 파티 12px). 얼굴은 낱장 파일(48×48)
  // 한 장이므로 상자 크기로 축소해 통째로 건다 — 시트 열/행 계산은 없다.
  // 그리는 기하를 인라인으로 잡는다 — 예전 `.actor-sheet-crop` 공용 생상은 진짜 시트(charset)
  // 후손이라 얼굴은 이제 그 생상을 실지 않는다.
  const url = resolveAssetResourceUrl(row.faceResourceId, { project });
  if (!url) {
    return el("span", {
      class: "status-menu-face missing",
      text: row.name.trim().slice(0, 1),
      attrs: { role: "img", "aria-label": row.name },
      dataset: { testid: testId },
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
    dataset: { testid: testId },
  });
}

/** The same actor appearance and session override as the field sprite. */
function renderPartyCharacter(project: PlayerStatusMenuOptions["project"], session: PlayerStatusMenuOptions["session"], row: PlayerStatusMenuPartyRow, index: number, faceSize: number): HTMLElement {
  const actor = project.database.actors.find((entry) => entry.id === row.actorId);
  const effective = actor ? resolveActorAppearance(project, actor) : undefined;
  const override = session.actorCharacterResourceIds?.[row.actorId];
  const sprite = resolvePlayerSpriteResource(project, { ...session, partyActorIds: [row.actorId] });
  const url = resolveAssetResourceUrl(sprite.resourceId, { project });
  if (!url) return renderPartyFace(project, row, index, faceSize, `status-menu-overview-face-${index}`);
  const node = el("span", {
    class: "status-menu-character",
    attrs: { role: "img", "aria-label": row.name },
    dataset: { testid: `status-menu-overview-character-${index}` },
  });
  const requested = override ?? effective?.characterResourceId;
  const requestedId = requested ? findCharsetAsset(requested)?.id ?? requested : undefined;
  const characterIndex = override === undefined && requestedId === sprite.resourceId ? effective?.characterIndex ?? 0 : 0;
  applyCharsetFrameCrop(node, url, { characterIndex, direction: "down", pattern: 1 }, 1);
  return node;
}

// ── 스킨 첫 화면: 파티 개요(party·sheet) ──
// 작업 패널 자리에 파티 4명을 크게 그린다 — 얼굴 30px · 이름 · 직업 · Lv · HP/MP 게이지+숫자 · 「위험」 칩.
// 상태이상 칩은 세션에 필드 상태이상 데이터가 없어 아직 없다(스펙 §2).
function renderPartyOverview(project: PlayerStatusMenuOptions["project"], snapshot: PlayerStatusMenuSnapshot, faceSize: number, characterSession?: PlayerStatusMenuOptions["session"]): HTMLElement {
  const overview = el("section", {
    class: "status-menu-party-overview",
    attrs: { "aria-label": "파티 상태" },
    dataset: { testid: "status-menu-party-overview" },
  });
  if (snapshot.emptyPartyLabel) {
    overview.append(el("div", { class: "status-menu-empty", text: snapshot.emptyPartyLabel }));
    return overview;
  }
  snapshot.partyRows.forEach((row, index) => {
    overview.append(el("article", {
      class: `status-menu-overview-row ${row.hpLevel}`,
      attrs: { "aria-label": `${row.name} ${row.levelLabel} ${row.hpLabel} ${row.mpLabel}` },
      dataset: { testid: `status-menu-overview-row-${index}` },
      children: [
        characterSession
          ? renderPartyCharacter(project, characterSession, row, index, faceSize)
          : renderPartyFace(project, row, index, faceSize, `status-menu-overview-face-${index}`),
        el("div", {
          class: "status-menu-overview-info",
          children: [
            el("div", {
              class: "status-menu-overview-head",
              children: [
                el("span", { class: "status-menu-actor-name", text: row.name }),
                el("span", { class: "status-menu-actor-subline", text: `${row.className} · Lv ${row.level}` }),
                ...(row.hpLevel === "crit" ? [el("span", { class: "status-menu-overview-chip crit", text: "위험" })] : []),
              ],
            }),
            renderOverviewVital("HP", row.hpValueLabel, row.hpRatio, `hp ${row.hpLevel}`, `status-menu-overview-hp-${index}`),
            renderOverviewVital("MP", row.mpValueLabel, row.mpRatio, "mp", `status-menu-overview-mp-${index}`),
          ],
        }),
      ],
    }));
  });
  return overview;
}

/** 라벨 + 트랙 + 숫자 한 줄. 트랙은 renderOverviewTrack 이 그려 사이드 파티와 같은 모양을 쓴다. */
function renderOverviewVital(label: string, value: string, ratio: number, variant: string, testId: string): HTMLElement {
  return el("div", {
    class: "status-menu-overview-vital",
    children: [
      el("span", { class: "status-menu-overview-vital-label", text: label }),
      renderOverviewTrack(ratio, variant, testId),
      el("span", { class: "status-menu-overview-value", text: value }),
    ],
  });
}

/** 허브 첫 화면의 파티 스트립 — 타일 격자 아래 4칸(얼굴 24px·이름·HP/MP 트랙·HP 수치). */
function renderPartyStrip(project: PlayerStatusMenuOptions["project"], snapshot: PlayerStatusMenuSnapshot): HTMLElement {
  return el("section", {
    class: "status-menu-party-strip",
    attrs: { "aria-label": "파티" },
    dataset: { testid: "status-menu-party-strip" },
    children: snapshot.partyRows.map((row, index) => el("div", {
      class: `status-menu-strip-card ${row.hpLevel}`,
      dataset: { testid: `status-menu-strip-card-${index}` },
      children: [
        renderPartyFace(project, row, index, 24, `status-menu-strip-face-${index}`),
        el("div", {
          class: "status-menu-strip-body",
          children: [
            el("span", { class: "status-menu-actor-name", text: row.name }),
            renderOverviewTrack(row.hpRatio, `hp ${row.hpLevel}`, `status-menu-strip-hp-${index}`),
            renderOverviewTrack(row.mpRatio, "mp", `status-menu-strip-mp-${index}`),
            el("span", { class: "status-menu-strip-value", text: row.hpValueLabel }),
          ],
        }),
      ],
    })),
  });
}

function renderOverviewTrack(ratio: number, variant: string, testId: string): HTMLElement {
  const percent = `${Math.round(ratio * 1000) / 10}%`;
  return el("div", {
    class: `status-menu-overview-track ${variant}`,
    attrs: {
      role: "meter",
      "aria-valuemin": "0",
      "aria-valuemax": "100",
      "aria-valuenow": String(Math.round(ratio * 100)),
    },
    dataset: { testid: testId },
    children: [el("span", { class: "status-menu-overview-fill", attrs: { style: `width:${percent}` } })],
  });
}

// ── 스킨 사이드 파티: 작업 패널 오른쪽 열의 파티 미니(function 모드) ──
// 회복약을 고르면서 누가 아픈지 보이게 한다 — 얼굴 12px · 이름 · HP 숫자 · HP/MP 트랙.
function renderSidePartyMini(project: PlayerStatusMenuOptions["project"], snapshot: PlayerStatusMenuSnapshot): HTMLElement {
  const aside = el("aside", {
    class: "status-menu-side-party",
    attrs: { "aria-label": "파티 상태" },
    dataset: { testid: "status-menu-side-party" },
    children: [el("div", { class: "status-menu-side-party-title", text: "파티" })],
  });
  if (snapshot.emptyPartyLabel) {
    aside.append(el("div", { class: "status-menu-empty", text: snapshot.emptyPartyLabel }));
    return aside;
  }
  snapshot.partyRows.forEach((row, index) => {
    aside.append(el("div", {
      class: `status-menu-side-party-row ${row.hpLevel}`,
      attrs: { "aria-label": `${row.name} ${row.hpLabel} ${row.mpLabel}` },
      dataset: { testid: `status-menu-side-party-row-${index}` },
      children: [
        renderPartyFace(project, row, index, 10, `status-menu-side-party-face-${index}`),
        el("div", {
          class: "status-menu-side-party-body",
          children: [
            el("div", {
              class: "status-menu-side-party-head",
              children: [
                el("span", { class: "status-menu-actor-name", text: row.name }),
                el("span", { class: "status-menu-side-party-value", text: row.hpValueLabel }),
              ],
            }),
            renderOverviewTrack(row.hpRatio, `hp ${row.hpLevel}`, `status-menu-side-party-hp-${index}`),
            renderOverviewTrack(row.mpRatio, "mp", `status-menu-side-party-mp-${index}`),
          ],
        }),
      ],
    }));
  });
  return aside;
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

/** 상세 패널의 actionIndex 배정 규칙(renderStatusMenuDetailPanel)과 같은 순서로 세어
    커서가 올라간 조작 가능 항목의 설명을 찾는다. */
function selectedEntryDescription(detail: StatusMenuDetail, selectedActionIndex: number | undefined): string | undefined {
  if (selectedActionIndex === undefined) return undefined;
  let actionIndex = 0;
  for (const entry of detail.entries) {
    if (!entry.onActivate || entry.disabled) continue;
    if (actionIndex === selectedActionIndex) return entry.unavailableReason ?? entry.description;
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
  mode: "main" | "function",
  message: string | undefined,
  railColumns: number
): HTMLElement {
  const footer = el("footer", { class: "status-menu-footer" });
  footer.append(el("div", {
    class: "status-menu-message",
    text: message ?? "",
    attrs: { role: "status" },
    dataset: { testid: "status-menu-message" },
  }));
  footer.append(el("span", {
    class: "status-menu-controls",
    text: statusMenuControls(mode, railColumns),
    dataset: { testid: "status-menu-controls" },
  }));
  return footer;
}

export function statusMenuControls(mode: "main" | "function", railColumns = 1): string {
  if (mode === "function") return "↑↓ 항목 이동   Enter 결정   ← 메뉴   Esc 뒤로";
  // 격자 레일(허브 타일)은 → 가 선택이 아니라 이동이다.
  return railColumns > 1 ? "↑↓←→ 이동   Enter 선택   Esc 게임으로" : "↑↓ 메뉴 이동   → / Enter 선택   Esc 게임으로";
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

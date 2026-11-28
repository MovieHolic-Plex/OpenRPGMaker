/**
 * ESC 메뉴 라이브 미리보기 및 항목별 런타임 표시 조건 뱃지.
 *
 * 「게임 설정 → 게임 메뉴」(외형)와 「메뉴·시스템」(항목·순서) 양쪽이 같은 미리보기를 써서
 * 허브 카드형 vs 옛 메뉴 스킨, HUD 메뉴 덮어쓰기 충돌, 항목별 숨김 조건을 한눈에 보여 준다.
 */
import { noticeBar, sectionCard } from "@/editor/panels/databaseWorkspace";
import { hubMenuEnabled, HUB_TILE_COMMANDS, isHubTileCommand } from "@/player/hubMenu";
import { menuSkinFor } from "@/player/menuSkins/registry";
import {
  createPlayerStatusMenuSnapshot,
  listStatusMenuCommandIds,
  statusMenuCommandLabel,
} from "@/player/playerStatusMenuModel";
import { resolveBestiary } from "@/project/bestiary";
import { backlogEnabled } from "@/project/dialogueSystem";
import { fieldMenu, type FieldMenuCommand } from "@/project/fieldMenu";
import { isGiftSystemEnabled } from "@/project/friendship";
import { isGalleryEnabled } from "@/project/gallery";
import { monsterCampaign, monsterDexSpeciesIds } from "@/project/monsterJournal";
import { hasPartyBonds } from "@/project/partyBonds";
import { usesRelationshipMenu } from "@/project/relationshipMenu";
import { resolveRestMenu } from "@/project/restMenu";
import { startSession } from "@/project/session";
import type { Project } from "@/project/types";
import { galleryActive, resolveVnExtras } from "@/project/vnExtras";
import { el } from "@/util/dom";

export const DEFAULT_HUB_WINDOW_COLOR = "#18216a";
export const DEFAULT_HUB_ACCENT_COLOR = "#ffe27a";

export type CommandRuntimeBadge = {
  readonly text: string;
  readonly tone: "warn" | "info";
};

/**
 * ESC 메뉴 항목 하나가 현재 프로젝트 설정에서 런타임에 숨겨지거나 조건부로만 나타나는지 알려 준다.
 * 항상 보이면 undefined.
 */
export function escCommandRuntimeHint(project: Project, command: FieldMenuCommand): CommandRuntimeBadge | undefined {
  switch (command) {
    case "save":
      return project.system.saveAccess === "savePoints"
        ? { text: "세이브 포인트 전용(숨김)", tone: "warn" }
        : undefined;
    case "backlog":
      return !backlogEnabled(project) ? { text: "백로그 꺼짐(숨김)", tone: "warn" } : undefined;
    case "gallery":
      return !isGalleryEnabled(project) && !galleryActive(project)
        ? { text: "갤러리 꺼짐(숨김)", tone: "warn" }
        : undefined;
    case "endings": {
      const vn = resolveVnExtras(project);
      if (!vn?.endings.enabled) return { text: "엔딩 목록 꺼짐(숨김)", tone: "warn" };
      if ((project.endings ?? []).length === 0) return { text: "엔딩 없음(숨김)", tone: "info" };
      return undefined;
    }
    case "rest":
      return !resolveRestMenu(project) ? { text: "쉬기 꺼짐(숨김)", tone: "warn" } : undefined;
    case "bestiary":
      return !resolveBestiary(project) ? { text: "도감 꺼짐(숨김)", tone: "warn" } : undefined;
    case "journal":
      return { text: "일지 기록 후 표시", tone: "info" };
    case "monster-dex":
      if (monsterDexSpeciesIds(project).length === 0) return { text: "몬스터 종 없음(숨김)", tone: "warn" };
      if (project.switches.some((sw) => sw.id === "mx_pokedex_received")) {
        return { text: "도감 획득 스위치 후 표시", tone: "info" };
      }
      return undefined;
    case "region-map":
    case "campaign-progress":
      return !monsterCampaign(project) ? { text: "원정 캠페인 없음(숨김)", tone: "warn" } : undefined;
    case "relationships": {
      const hasAny = isGiftSystemEnabled(project) || hasPartyBonds(project) || usesRelationshipMenu(project);
      return !hasAny ? { text: "호감·선물 기능 꺼짐", tone: "info" } : undefined;
    }
    case "life-ledger":
      return { text: "생활 기록 후 표시", tone: "info" };
    default:
      return undefined;
  }
}

export type EscMenuPreviewOptions = {
  readonly onClearHudOverride?: () => void;
  readonly jumpAction?: { readonly label: string; readonly testid: string; readonly onClick: () => void };
};

/** 에디터 미리보기 세션 기준 이 프로젝트가 실효 허브 카드형 ESC 메뉴를 쓰는지 판별한다. */
export function projectUsesHubMenu(project: Project): boolean {
  return hubMenuEnabled(project, startSession(project, 1));
}

/**
 * 현재 프로젝트 설정으로 플레이 시 실제로 열리는 ESC 메뉴의 라이브 미리보기 카드.
 */
export function renderEscMenuPreviewCard(project: Project, options: EscMenuPreviewOptions = {}): HTMLElement {
  const session = startSession(project, 1);
  const usesHub = hubMenuEnabled(project, session);
  const skin = menuSkinFor(project);
  const authored = fieldMenu(project);
  const visibleCommands = listStatusMenuCommandIds(project, session);
  const snapshot = createPlayerStatusMenuSnapshot(project, session, { waitModeEnabled: true });
  const hudOverride = project.system.fieldHud?.menuStyle && project.system.fieldHud.menuStyle !== "project"
    ? project.system.fieldHud.menuStyle
    : undefined;

  const children: HTMLElement[] = [];

  if (hudOverride) {
    children.push(
      noticeBar({
        text: `인게임 HUD의 메뉴 설정(${hudOverride})이 게임 메뉴 디자인을 덮어쓰고 있습니다. 해제하면 여기서 고른 디자인이 적용됩니다.`,
        tone: "warn",
        testid: "db-menu-hud-override-notice",
        ...(options.onClearHudOverride
          ? {
              action: {
                label: "HUD 덮어쓰기 해제",
                testid: "db-menu-clear-hud-override",
                onClick: options.onClearHudOverride,
              },
            }
          : {}),
      }),
    );
  }

  const stage = usesHub
    ? renderHubPreviewStage(project, snapshot, visibleCommands)
    : renderLegacyPreviewStage(skin.id, skin.label, snapshot);

  const metaItems: HTMLElement[] = [
    el("span", {
      class: "db-menu-preview-chip",
      dataset: { testid: "db-menu-preview-mode" },
      text: usesHub ? "표시 틀: 허브 카드형" : `표시 틀: 옛 메뉴 · ${skin.label}`,
    }),
    el("span", {
      class: "db-menu-preview-chip",
      dataset: { testid: "db-menu-preview-source" },
      text: authored ? `항목: 직접 저작 ${authored.entries.length}개` : `항목: 기본 자동 구성(${visibleCommands.length}개 보임)`,
    }),
    el("span", {
      class: "db-menu-preview-chip",
      text: project.system.saveAccess === "savePoints" ? "저장: 세이브 포인트 전용" : "저장: 메뉴에서 언제든",
    }),
  ];

  children.push(
    el("div", { class: "db-menu-preview-meta", children: metaItems }),
    stage,
  );

  if (options.jumpAction) {
    children.push(
      el("div", {
        class: "db-menu-preview-actions",
        children: [
          el("button", {
            class: "db-ws-btn",
            text: options.jumpAction.label,
            attrs: { type: "button" },
            dataset: { testid: options.jumpAction.testid },
            on: { click: options.jumpAction.onClick },
          }),
        ],
      }),
    );
  }

  return sectionCard({
    title: "ESC 메뉴 미리보기",
    hint: usesHub ? "허브 카드형(기본)" : skin.label,
    testid: "db-menu-live-preview",
    children,
  });
}

function renderHubPreviewStage(
  project: Project,
  snapshot: ReturnType<typeof createPlayerStatusMenuSnapshot>,
  visibleCommands: readonly FieldMenuCommand[],
): HTMLElement {
  const winColor = project.system.menuTheme?.window || DEFAULT_HUB_WINDOW_COLOR;
  const accentColor = project.system.menuTheme?.accent || DEFAULT_HUB_ACCENT_COLOR;
  const tiles = HUB_TILE_COMMANDS.filter((command) => visibleCommands.includes(command));
  const others = visibleCommands.filter((command) => !isHubTileCommand(command));
  const party = snapshot.partyRows.slice(0, 4);

  const stage = el("div", {
    class: "db-menu-preview-stage is-hub",
    dataset: { testid: "db-menu-preview-hub-stage" },
    children: [
      el("div", {
        class: "db-menu-preview-hub-party",
        children: party.length > 0
          ? party.map((member) =>
              el("div", {
                class: "db-menu-preview-hub-card",
                children: [
                  el("strong", { text: member.name }),
                  el("small", { text: `${member.levelLabel} · ${member.className}` }),
                  el("span", { class: "db-menu-preview-hub-vital", text: member.hpLabel }),
                ],
              }),
            )
          : [el("div", { class: "db-menu-preview-hub-card", text: "초기 파티 없음" })],
      }),
      el("div", {
        class: "db-menu-preview-hub-right",
        children: [
          el("div", {
            class: "db-menu-preview-hub-tiles",
            children: tiles.map((command) =>
              el("span", {
                class: "db-menu-preview-hub-tile",
                text: statusMenuCommandLabel(command, true, project),
              }),
            ),
          }),
          el("div", {
            class: "db-menu-preview-hub-bar",
            children: [
              el("span", { class: "db-menu-preview-hub-gold", text: snapshot.showGold === false ? snapshot.timeLabel : `${snapshot.goldLabel} · ${snapshot.timeLabel}` }),
              el("div", {
                class: "db-menu-preview-hub-others",
                children: others.map((command) =>
                  el("span", {
                    class: "db-menu-preview-hub-pill",
                    text: statusMenuCommandLabel(command, true, project),
                  }),
                ),
              }),
            ],
          }),
        ],
      }),
    ],
  });
  stage.style.setProperty("--preview-hub-win", winColor);
  stage.style.setProperty("--preview-hub-accent", accentColor);
  return stage;
}

function renderLegacyPreviewStage(
  skinId: string,
  skinLabel: string,
  snapshot: ReturnType<typeof createPlayerStatusMenuSnapshot>,
): HTMLElement {
  return el("div", {
    class: "db-menu-preview-stage is-legacy",
    dataset: { testid: "db-menu-preview-legacy-stage", skinId },
    children: [
      el("div", {
        class: "db-menu-preview-legacy-thumb",
        children: [
          el("img", {
            attrs: {
              src: `/assets/ui/menu-skins/${skinId}.png`,
              alt: skinLabel,
              width: "320",
              height: "240",
            },
          }),
          el("span", { class: "db-menu-preview-legacy-caption", text: skinLabel }),
        ],
      }),
      el("div", {
        class: "db-menu-preview-legacy-list",
        children: [
          el("strong", { text: `실제 표시 명령 (${snapshot.commands.length}개)` }),
          el("ul", {
            children: snapshot.commands.map((command) =>
              el("li", { text: command.opensGroup ? `${command.label} ▸` : command.label }),
            ),
          }),
          el("small", {
            text: snapshot.relationship
              ? "관계 중심 첫 화면(호감도 요약)"
              : snapshot.story
                ? "이야기 중심 첫 화면(전투 수치 숨김)"
                : `파티 ${snapshot.partyRows.length}명 · ${snapshot.goldLabel}`,
          }),
        ],
      }),
    ],
  });
}

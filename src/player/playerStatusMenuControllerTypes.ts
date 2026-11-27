import type { PlayScene } from "@/player/PlayScene";
import type { SaveSlotIndex } from "@/player/saveSlots";
import type { StatusMenuCommandId } from "@/player/playerStatusMenu";
import type { RuntimeJuiceEvent } from "@/player/runtimeJuice";
import type { RuntimeMenuKey } from "@/player/runtimeKeyboardMenu";

export type PlayerStatusMenuControllerOptions = {
  readonly layout: HTMLElement;
  readonly getActiveScene: () => PlayScene | undefined;
  readonly getPlayStage: () => HTMLElement | null;
  readonly closeMenu: () => void;
  readonly closeMenuWithJuice: () => void;
  readonly renderTitle: () => void;
  /** cue: 이 사건이 먼저 찾아볼 효과음 자리(save·load·equip·useItem — project.system.seCues). */
  readonly emitMenuJuice: (event: RuntimeJuiceEvent, target?: HTMLElement | null, cue?: string) => void;
  readonly menuCloseJuiceMs: number;
  readonly loadSlot: (slot: SaveSlotIndex, fromTitle: boolean) => void;
  readonly loadAutosave?: (fromTitle: boolean) => void;
  /** 데스크톱 셸이나 종료 지원 호스트에서 「게임 종료」 실행 시 호출. */
  readonly onQuitGame?: () => void;
};

export type PlayerStatusMenuController = {
  readonly reset: () => void;
  readonly renderMenu: (message?: string, selectedCommand?: StatusMenuCommandId) => HTMLElement | null;
  readonly openSaveMenu: () => void;
  /** 이벤트의 「메뉴 화면 열기」(screen:monster-box)가 보관함(PC) 화면을 바로 연다. */
  readonly openMonsterBox: () => void;
  /** 이벤트의 「메뉴 화면 열기」(screen:skills, actorId 선택)가 스킬 장착 화면을 바로 연다. actorId 가 없거나 파티에 없으면 파티장. */
  readonly openSkillScreen: (actorId?: string) => void;
  /** Opens the life ledger on the recovery tab when session claims remain. */
  readonly openLifeRecoveryLedger: () => void;
  readonly toggleMenu: () => void;
  readonly handleKey: (key: RuntimeMenuKey) => boolean;
  /** 허브 메뉴 전용 키(첫 화면 1~4, 동료 넘기기 Q·E·PageUp·PageDown). 런타임 메뉴 키가 아니라 따로 받는다. */
  readonly handleExtraKey: (key: string) => boolean;
  readonly isCapturingKey: () => boolean;
};

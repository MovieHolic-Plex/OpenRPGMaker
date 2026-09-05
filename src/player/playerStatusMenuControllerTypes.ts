import type { PlayScene } from "@/player/PlayScene";
import type { SaveSlotIndex } from "@/player/saveSlots";
import type { StatusMenuCommandId } from "@/player/playerStatusMenu";
import type { RuntimeJuiceEvent } from "@/player/runtimeJuice";
import type { RuntimeMenuKey } from "@/player/runtimeKeyboardMenu";

export type PlayerStatusMenuControllerOptions = {
  readonly layout: HTMLElement;
  readonly getActiveScene: () => PlayScene | undefined;
  readonly getPlayStage: () => HTMLElement | null;
  readonly getPlayStartedAt: () => number;
  readonly closeMenu: () => void;
  readonly closeMenuWithJuice: () => void;
  readonly renderTitle: () => void;
  readonly emitMenuJuice: (event: RuntimeJuiceEvent, target?: HTMLElement | null) => void;
  readonly menuCloseJuiceMs: number;
  readonly loadSlot: (slot: SaveSlotIndex, fromTitle: boolean) => void;
};

export type PlayerStatusMenuController = {
  readonly reset: () => void;
  readonly renderMenu: (message?: string, selectedCommand?: StatusMenuCommandId) => HTMLElement | null;
  readonly openSaveMenu: () => void;
  readonly toggleMenu: () => void;
  readonly handleKey: (key: RuntimeMenuKey) => boolean;
};

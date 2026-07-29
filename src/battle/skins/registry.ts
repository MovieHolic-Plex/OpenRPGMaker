import type { BattleSkin, BattleSkinId } from "@/battle/skins/types";

export const BATTLE_SKINS: Record<BattleSkinId, BattleSkin> = {
  pokemon: {
    id: "pokemon", defaultBackdropResourceId: "battle-skin-pokemon-backdrop", label: "포켓몬", layout: "frontview", showAllySprites: true,
    hudTemplate: "boxes", transition: "flash-white",
    themeVars: { "--battle-window-bg": "#f8f8f8", "--battle-window-edge": "#4858a0", "--battle-text": "#282828", "--battle-accent": "#f04030" },
  },
  rm2003: {
    id: "rm2003", defaultBackdropResourceId: "battle-skin-rm2003-backdrop", label: "RM2003", layout: "sideview", showAllySprites: true,
    hudTemplate: "rows", transition: "wipe-blue",
    themeVars: { "--battle-window-bg": "#1742a5", "--battle-window-edge": "#315dc0", "--battle-text": "#f8fbff", "--battle-accent": "#ffd75a" },
  },
  rm2000: {
    id: "rm2000", defaultBackdropResourceId: "battle-skin-rm2000-backdrop", label: "RM2000", layout: "frontview", showAllySprites: false,
    hudTemplate: "rows", transition: "wipe-blue",
    themeVars: { "--battle-window-bg": "#101c48", "--battle-window-edge": "#2a52a0", "--battle-text": "#eef4ff", "--battle-accent": "#ffcf3a" },
  },
  octopath: {
    id: "octopath", defaultBackdropResourceId: "battle-skin-octopath-backdrop", label: "옥토패스", layout: "sideview", showAllySprites: true,
    hudTemplate: "minimal", transition: "focus-blur",
    themeVars: { "--battle-window-bg": "#0c1220", "--battle-window-edge": "#c9a24a", "--battle-text": "#f2e9d0", "--battle-accent": "#e0b24a" },
  },
  chrono: {
    id: "chrono", defaultBackdropResourceId: "battle-skin-chrono-backdrop", label: "크로노 트리거", layout: "active", showAllySprites: true,
    hudTemplate: "ring", transition: "sweep-cyan",
    themeVars: { "--battle-window-bg": "#0a1a3a", "--battle-window-edge": "#2fa8ff", "--battle-text": "#eaf6ff", "--battle-accent": "#ffd24a" },
  },
  bravely: {
    id: "bravely", defaultBackdropResourceId: "battle-skin-bravely-backdrop", label: "브레이블리", layout: "sideview", showAllySprites: true,
    hudTemplate: "minimal", transition: "focus-blur",
    themeVars: { "--battle-window-bg": "#141018", "--battle-window-edge": "#b89a6a", "--battle-text": "#f6efe2", "--battle-accent": "#d8a24a" },
  },
  dragonquest: {
    id: "dragonquest", defaultBackdropResourceId: "battle-skin-dragonquest-backdrop", label: "드퀘", layout: "firstperson", showAllySprites: false,
    hudTemplate: "rows", transition: "flash-white",
    themeVars: { "--battle-window-bg": "#000814", "--battle-window-edge": "#f8f8f8", "--battle-text": "#f8f8f8", "--battle-accent": "#f8d030" },
  },
  ff: {
    id: "ff", defaultBackdropResourceId: "battle-skin-ff-backdrop", label: "FF 정통", layout: "sideview", showAllySprites: true,
    hudTemplate: "rows", transition: "wipe-blue",
    themeVars: { "--battle-window-bg": "#101838", "--battle-window-edge": "#5878c8", "--battle-text": "#f4f8ff", "--battle-accent": "#48c0f0" },
  },
  mother: {
    id: "mother", defaultBackdropResourceId: "battle-skin-mother-backdrop", label: "마더/언더", layout: "frontview", showAllySprites: false,
    hudTemplate: "rows", transition: "psychedelic",
    themeVars: { "--battle-window-bg": "#101010", "--battle-window-edge": "#f8f8f8", "--battle-text": "#f8f8f8", "--battle-accent": "#ff4fd8" },
  },
  goldensun: {
    id: "goldensun", defaultBackdropResourceId: "battle-skin-goldensun-backdrop", label: "골든선", layout: "sideview", showAllySprites: true,
    hudTemplate: "boxes", transition: "sweep-cyan",
    themeVars: { "--battle-window-bg": "#0e1830", "--battle-window-edge": "#e0a030", "--battle-text": "#f4ecd8", "--battle-accent": "#ffcf3a" },
  },
  mv: {
    id: "mv", defaultBackdropResourceId: "battle-skin-rm2003-backdrop", label: "RPG Maker MV", layout: "frontview", showAllySprites: false,
    hudTemplate: "rows", transition: "wipe-blue",
    themeVars: { "--battle-window-bg": "#e8e8f0", "--battle-window-edge": "#1a2a6c", "--battle-text": "#1c2438", "--battle-accent": "#3858c8" },
  },
  // VX Ace 계열 JRPG 프론트뷰(기본 스킨): 우측 세로 명령창 + 하단 가로 파티 셀(얼굴 초상 포함).
  vxace: {
    id: "vxace", defaultBackdropResourceId: "battle-skin-vxace-backdrop", label: "VX Ace", layout: "frontview", showAllySprites: false,
    hudTemplate: "boxes", transition: "wipe-blue",
    themeVars: { "--battle-window-bg": "#0b1020", "--battle-window-edge": "#20263c", "--battle-text": "#f4f7ff", "--battle-accent": "#ffd75a" },
  },
};

const VALID_IDS = new Set(Object.keys(BATTLE_SKINS) as BattleSkinId[]);

export function getBattleSkin(id: BattleSkinId): BattleSkin {
  return BATTLE_SKINS[id];
}

export function listBattleSkinIds(): BattleSkinId[] {
  return Object.keys(BATTLE_SKINS) as BattleSkinId[];
}

/** 미설정/미지의 값이 떨어지는 기본 스킨. */
export const DEFAULT_BATTLE_SKIN_ID: BattleSkinId = "vxace";

/** legacy(`classic`/`pokemon`/undefined) 및 임의 문자열을 유효 스킨 id로 정규화한다.
 *  미설정(undefined)은 기본 스킨(vxace)으로, legacy `classic` 은 rm2003 으로 남긴다. */
export function resolveSkinId(legacy: string | undefined): BattleSkinId {
  if (legacy === "pokemon") return "pokemon";
  if (legacy === "classic") return "rm2003";
  if (!legacy) return DEFAULT_BATTLE_SKIN_ID;
  return VALID_IDS.has(legacy as BattleSkinId) ? (legacy as BattleSkinId) : DEFAULT_BATTLE_SKIN_ID;
}

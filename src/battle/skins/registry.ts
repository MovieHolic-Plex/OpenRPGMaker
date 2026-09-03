// battle/skins/registry.ts
//
// ⚠ 라벨 작명 규약 (2026-08-21)
// `label` 은 자료집→시스템의 전투 스킨 드롭다운(databaseSystemView.ts)에 그대로
// 뿌려진다. 즉 **사용자에게 보이는 문자열**이다. 여기에 다른 회사 제품·프랜차이즈
// 이름을 쓰지 않는다. 라벨은 그 스킨이 실제로 무엇처럼 보이는지를 서술한다
// (창 색 · 레이아웃 · HUD 형태). 금지 표현의 권위 있는 목록은 한 곳에만 둔다 —
// `test/detsukuruBrandStrings.test.ts` 가 이 파일의 라벨을 검사한다.
//
// `id` 는 프로젝트 파일에 저장되므로 함부로 바꾸지 않는다 — 바꿀 때는 `resolveSkinId`
// 에 옛 id 의 매핑을 남겨 저장된 전투 설정이 깨지지 않게 한다.
//
// 2026-09-03: 정면 전투 스킨 id `rm2003` → `rm2000` 개명. 옛 id 는 이름만 2003 이었고
// 실제 구도는 아군이 필드에 서지 않는 **정면(2000식) 전투**였다. 같은 구도의 deprecated
// 스킨 `rm2000`(감청 창)은 이 하나로 흡수했다 — 저장된 `"rm2003"`·`"rm2000"`·`"classic"`
// 은 전부 이 스킨으로 풀린다. 그래서 등록 스킨은 12 → 11 종이다.
//
// 2026-08-21: 라벨 전부 교체 완료. 예전에는 타사 프랜차이즈 이름을 그대로 썼다.
// 라벨은 이제 **창 색 + 레이아웃/HUD 특징**을 말하고 서로 구분된다:
//   흰 창·박스 HUD / 유리 창·정면 필드 / 먹빛 창·최소 HUD /
//   청람 창·링 게이지 / 세피아 창·주황 강조 / 검은 창·1인칭 시점 /
//   코발트 창·청록 강조 / 암전 창·형광 분홍 / 금갈색 창·박스 HUD /
//   밝은 창·정면 / 심야 창·박스 HUD
// 새 스킨을 추가할 때도 같은 규칙을 따를 것 — 스펙이 라벨을 검사한다.
import type { BattleSkin, BattleSkinId } from "@/battle/skins/types";

export const BATTLE_SKINS: Record<BattleSkinId, BattleSkin> = {
  pokemon: {
    id: "pokemon", defaultBackdropResourceId: "battle-skin-pokemon-backdrop", label: "흰 창 · 박스 HUD", layout: "frontview", showAllySprites: true,
    hudTemplate: "boxes", transition: "slide-pokemon",
    themeVars: {
      "--battle-window-bg": "#f8f8f8",
      "--battle-window-edge": "#3a4ea8",
      "--battle-window-inner": "#ffffff",
      "--battle-text": "#1a1a2e",
      "--battle-text-muted": "#6b7280",
      "--battle-accent": "#ef2d2d",
      "--battle-accent-soft": "rgba(239,45,45,.14)",
      "--battle-hp-high": "#22c55e",
      "--battle-hp-mid": "#eab308",
      "--battle-hp-low": "#ef4444",
      "--battle-shadow": "0 4px 16px rgba(58,78,168,.18)",
      "--battle-cursor": "#ef2d2d",
      "--battle-backdrop-filter": "saturate(1.08) contrast(1.04)",
    },
  },
  // 정면 전투(아군 스프라이트 없음, 하단 유리 카드 HUD). 배경 리소스 id 는 저장 데이터가
  // 참조하는 식별자라 개명하지 않는다(그림 파일도 rm2003-backdrop.png 그대로).
  // 강조색은 따뜻한 호박색 하나다 — 커서 · 차례 액터 · ATB · 확인 버튼이 전부 이 색을 쓴다.
  // 남색 유리 표면(런타임 공용 토큰) 위에서 남보라 강조는 "AI 보라 그라데이션" 으로 읽혔고(디자인
  // 감사), 밤 숲·초록 몬스터 위에서도 대비가 약했다. HP(민트)·MP(하늘)는 의미색이라 별개다.
  rm2000: {
    id: "rm2000", defaultBackdropResourceId: "battle-skin-rm2003-backdrop", label: "유리 창 · 정면 필드", layout: "frontview", showAllySprites: true,
    hudTemplate: "rows", transition: "wipe-blue",
    themeVars: {
      "--battle-window-bg": "rgba(14,18,34,.96)",
      "--battle-window-edge": "rgba(154,170,226,.32)",
      "--battle-window-inner": "rgba(4,6,16,.66)",
      "--battle-text": "#eef1fb",
      "--battle-text-muted": "#9aa4c4",
      "--battle-accent": "#f2c063",
      "--battle-accent-soft": "rgba(242,192,99,.22)",
      "--battle-hp-high": "#3ddc97",
      "--battle-hp-mid": "#ffc857",
      "--battle-hp-low": "#ff5f6d",
      "--battle-shadow": "0 8px 24px rgba(3,5,14,.55)",
      "--battle-cursor": "#f2c063",
      "--battle-backdrop-filter": "saturate(1.04) contrast(1.06)",
    },
  },
  octopath: {
    deprecated: true,
    id: "octopath", defaultBackdropResourceId: "battle-skin-octopath-backdrop", label: "먹빛 창 · 최소 HUD", layout: "sideview", showAllySprites: true,
    hudTemplate: "minimal", transition: "focus-blur",
    themeVars: {
      "--battle-window-bg": "#0a1020",
      "--battle-window-edge": "#c9a24a",
      "--battle-window-inner": "#141e32",
      "--battle-text": "#f5ecd0",
      "--battle-text-muted": "#b8a890",
      "--battle-accent": "#e8b84b",
      "--battle-accent-soft": "rgba(232,184,75,.14)",
      "--battle-hp-high": "#d4a574",
      "--battle-hp-mid": "#c9a24a",
      "--battle-hp-low": "#a0522d",
      "--battle-shadow": "0 10px 28px rgba(0,0,0,.5), inset 0 1px 0 rgba(201,162,74,.18)",
      "--battle-cursor": "#e8b84b",
      "--battle-backdrop-filter": "contrast(1.12) saturate(1.08) brightness(1.04)",
    },
  },
  chrono: {
    deprecated: true,
    id: "chrono", defaultBackdropResourceId: "battle-skin-chrono-backdrop", label: "청람 창 · 링 게이지", layout: "active", showAllySprites: true,
    hudTemplate: "ring", transition: "sweep-cyan",
    themeVars: {
      "--battle-window-bg": "#071a33",
      "--battle-window-edge": "#2ec4ff",
      "--battle-window-inner": "#0e2e5a",
      "--battle-text": "#e6f7ff",
      "--battle-text-muted": "#7fb8d8",
      "--battle-accent": "#ffcc33",
      "--battle-accent-soft": "rgba(255,204,51,.16)",
      "--battle-hp-high": "#00e5ff",
      "--battle-hp-mid": "#ffcc33",
      "--battle-hp-low": "#ff6b6b",
      "--battle-shadow": "0 0 24px rgba(46,196,255,.22), 0 8px 20px rgba(0,0,0,.4)",
      "--battle-cursor": "#2ec4ff",
      "--battle-backdrop-filter": "saturate(1.15) hue-rotate(-6deg) brightness(1.06)",
    },
  },
  bravely: {
    deprecated: true,
    id: "bravely", defaultBackdropResourceId: "battle-skin-bravely-backdrop", label: "세피아 창 · 주황 강조", layout: "sideview", showAllySprites: true,
    hudTemplate: "minimal", transition: "brave-shift",
    themeVars: {
      "--battle-window-bg": "#1a1206",
      "--battle-window-edge": "#c49a5a",
      "--battle-window-inner": "#2e1f0a",
      "--battle-text": "#fdf0d5",
      "--battle-text-muted": "#b8a082",
      "--battle-accent": "#ff8c42",
      "--battle-accent-soft": "rgba(255,140,66,.15)",
      "--battle-hp-high": "#ffb347",
      "--battle-hp-mid": "#ff8c42",
      "--battle-hp-low": "#c73e1d",
      "--battle-shadow": "0 8px 24px rgba(0,0,0,.45), inset 0 1px 0 rgba(196,154,90,.2)",
      "--battle-cursor": "#ff8c42",
      "--battle-backdrop-filter": "sepia(.18) saturate(1.1) brightness(1.03)",
    },
  },
  dragonquest: {
    deprecated: true,
    id: "dragonquest", defaultBackdropResourceId: "battle-skin-dragonquest-backdrop", label: "검은 창 · 1인칭 시점", layout: "firstperson", showAllySprites: false,
    hudTemplate: "rows", transition: "curtain-dq",
    themeVars: {
      "--battle-window-bg": "#000810",
      "--battle-window-edge": "#ffffff",
      "--battle-window-inner": "#0a0a0a",
      "--battle-text": "#ffffff",
      "--battle-text-muted": "#a0a0a0",
      "--battle-accent": "#ffd700",
      "--battle-accent-soft": "rgba(255,215,0,.14)",
      "--battle-hp-high": "#ffffff",
      "--battle-hp-mid": "#ffd700",
      "--battle-hp-low": "#ff4444",
      "--battle-shadow": "0 0 0 2px #fff, 0 8px 20px rgba(0,0,0,.6)",
      "--battle-cursor": "#ffd700",
      "--battle-backdrop-filter": "brightness(.45) contrast(1.2) saturate(.6)",
    },
  },
  ff: {
    deprecated: true,
    id: "ff", defaultBackdropResourceId: "battle-skin-ff-backdrop", label: "코발트 창 · 청록 강조", layout: "sideview", showAllySprites: true,
    hudTemplate: "rows", transition: "wipe-blue",
    themeVars: {
      "--battle-window-bg": "#0f1e7a",
      "--battle-window-edge": "#e8e8e8",
      "--battle-window-inner": "#1a2fb8",
      "--battle-text": "#ffffff",
      "--battle-text-muted": "#a8b8ff",
      "--battle-accent": "#00d4ff",
      "--battle-accent-soft": "rgba(0,212,255,.15)",
      "--battle-hp-high": "#00e5ff",
      "--battle-hp-mid": "#ffd54f",
      "--battle-hp-low": "#ff5252",
      "--battle-shadow": "0 0 0 3px #fff, 0 0 0 6px #0f1e7a, 0 8px 24px rgba(0,0,0,.4)",
      "--battle-cursor": "#00d4ff",
      "--battle-backdrop-filter": "saturate(1.08) brightness(1.05)",
    },
  },
  mother: {
    deprecated: true,
    id: "mother", defaultBackdropResourceId: "battle-skin-mother-backdrop", label: "암전 창 · 형광 분홍", layout: "frontview", showAllySprites: false,
    hudTemplate: "rows", transition: "psychedelic",
    themeVars: {
      "--battle-window-bg": "#0a0a0a",
      "--battle-window-edge": "#ffffff",
      "--battle-window-inner": "#1a1a1a",
      "--battle-text": "#ffffff",
      "--battle-text-muted": "#ff99e0",
      "--battle-accent": "#ff3bd8",
      "--battle-accent-soft": "rgba(255,59,216,.18)",
      "--battle-hp-high": "#ff3bd8",
      "--battle-hp-mid": "#7b68ee",
      "--battle-hp-low": "#00ff88",
      "--battle-shadow": "0 0 20px rgba(255,59,216,.25), 0 8px 20px rgba(0,0,0,.5)",
      "--battle-cursor": "#ff3bd8",
      "--battle-backdrop-filter": "hue-rotate(0deg) saturate(1.8) contrast(1.3)",
    },
  },
  goldensun: {
    deprecated: true,
    id: "goldensun", defaultBackdropResourceId: "battle-skin-goldensun-backdrop", label: "금갈색 창 · 박스 HUD", layout: "sideview", showAllySprites: true,
    hudTemplate: "boxes", transition: "sweep-cyan",
    themeVars: {
      "--battle-window-bg": "#1a0f02",
      "--battle-window-edge": "#ff9a1a",
      "--battle-window-inner": "#2e1a04",
      "--battle-text": "#ffe8c2",
      "--battle-text-muted": "#c49a60",
      "--battle-accent": "#ffcc33",
      "--battle-accent-soft": "rgba(255,204,51,.16)",
      "--battle-hp-high": "#ff9a1a",
      "--battle-hp-mid": "#ffcc33",
      "--battle-hp-low": "#cc3300",
      "--battle-shadow": "0 0 28px rgba(255,154,26,.22), 0 8px 20px rgba(0,0,0,.45)",
      "--battle-cursor": "#ff9a1a",
      "--battle-backdrop-filter": "sepia(.22) saturate(1.25) brightness(1.08) contrast(1.06)",
    },
  },
  mv: {
    deprecated: true,
    id: "mv", defaultBackdropResourceId: "battle-skin-mv-backdrop", label: "밝은 창 · 정면", layout: "frontview", showAllySprites: false,
    hudTemplate: "rows", transition: "fade",
    themeVars: {
      "--battle-window-bg": "#f0f0f8",
      "--battle-window-edge": "#2a3a6a",
      "--battle-window-inner": "#ffffff",
      "--battle-text": "#1a1a3a",
      "--battle-text-muted": "#6a7ab0",
      "--battle-accent": "#3b82f6",
      "--battle-accent-soft": "rgba(59,130,246,.12)",
      "--battle-hp-high": "#22c55e",
      "--battle-hp-mid": "#f59e0b",
      "--battle-hp-low": "#ef4444",
      "--battle-shadow": "0 4px 16px rgba(42,58,106,.15)",
      "--battle-cursor": "#3b82f6",
      "--battle-backdrop-filter": "saturate(1.02) brightness(1.02)",
    },
  },
  vxace: {
    deprecated: true,
    id: "vxace", defaultBackdropResourceId: "battle-skin-vxace-backdrop", label: "심야 창 · 박스 HUD", layout: "frontview", showAllySprites: false,
    hudTemplate: "boxes", transition: "fade",
    themeVars: {
      "--battle-window-bg": "#0a0f24",
      "--battle-window-edge": "#3a4a6a",
      "--battle-window-inner": "#141c38",
      "--battle-text": "#e8ecff",
      "--battle-text-muted": "#8a9ac0",
      "--battle-accent": "#60a5fa",
      "--battle-accent-soft": "rgba(96,165,250,.14)",
      "--battle-hp-high": "#4ade80",
      "--battle-hp-mid": "#facc15",
      "--battle-hp-low": "#f87171",
      "--battle-shadow": "0 6px 20px rgba(0,0,0,.4)",
      "--battle-cursor": "#60a5fa",
      "--battle-backdrop-filter": "saturate(1.04) brightness(1.0)",
    },
  },
};

const VALID_IDS = new Set(Object.keys(BATTLE_SKINS) as BattleSkinId[]);

export function getBattleSkin(id: BattleSkinId): BattleSkin {
  return BATTLE_SKINS[id];
}

export function listBattleSkinIds(): BattleSkinId[] {
  return Object.keys(BATTLE_SKINS) as BattleSkinId[];
}

/** 지원이 이어지는 스킨 2종 — 새 저작 UI가 노출하는 집합. */
export const ACTIVE_BATTLE_SKIN_IDS: readonly BattleSkinId[] = ["pokemon", "rm2000"];

/** BATTLE_SKINS 에서 deprecated 표식이 없는 id 만 추린다(ACTIVE_BATTLE_SKIN_IDS 와 동일해야 함). */
export function listActiveBattleSkinIds(): BattleSkinId[] {
  return listBattleSkinIds().filter((id) => !BATTLE_SKINS[id].deprecated);
}

export function isDeprecatedBattleSkin(id: BattleSkinId): boolean {
  return BATTLE_SKINS[id].deprecated === true;
}

/** 미설정/미지의 값이 떨어지는 기본 스킨. */
export const DEFAULT_BATTLE_SKIN_ID: BattleSkinId = "rm2000";

/** 저장 데이터에 남아 있을 수 있는 옛 정면 전투 스킨 id → 현재 id. */
const LEGACY_SKIN_ALIASES: Readonly<Record<string, BattleSkinId>> = {
  classic: "rm2000", // 2026-08 이전 별칭
  rm2003: "rm2000", // 2026-09-03 개명 전 id
};

/** legacy(`classic`/`rm2003`/`pokemon`/undefined) 및 임의 문자열을 유효 스킨 id로 정규화한다.
 *  미설정(undefined)은 기본 스킨(rm2000)으로, legacy `classic`·`rm2003` 은 rm2000 으로 푼다. */
export function resolveSkinId(legacy: string | undefined): BattleSkinId {
  if (legacy === "pokemon") return "pokemon";
  if (!legacy) return DEFAULT_BATTLE_SKIN_ID;
  const alias = LEGACY_SKIN_ALIASES[legacy];
  if (alias) return alias;
  return VALID_IDS.has(legacy as BattleSkinId) ? (legacy as BattleSkinId) : DEFAULT_BATTLE_SKIN_ID;
}

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
// 스킨 `rm2000`(감청 창)은 이 하나로 흡수했다 — 저장된 `"rm2000"`·`"classic"` 은 이 스킨으로 풀린다.
//
// 2026-09-03(같은 날, 감독 지시 "정면식·측면식·몬스터식 셋을 자료집에서 고를 수 있게"): `rm2003` 을
// **측면 전투** 스킨으로 되살렸다 — 적은 왼쪽, 아군 전투 시트는 오른쪽 사선 열에 선다. 유리 HUD 는
// rm2000 과 같은 파일(`_rm2000.css`)을 `family: "glass"` 로 나눠 쓰고, 배치·방향만 `_rm2003.css` 가 덮는다.
// 그래서 저장된 `"rm2003"` 은 더 이상 rm2000 으로 풀리지 않는다(오늘 이전에 저장된 프로젝트의 "rm2003" 은
// 측면 구도로 바뀐다 — 개명이 같은 날이라 감수한다). 활성 스킨 3종: pokemon · rm2000 · rm2003.
//
// 2026-09-25: 지원 종료 9종을 유리 뼈대의 변형으로 되살렸다(ACTIVE_BATTLE_SKIN_IDS). 스킨별 CSS 파일은 지웠고,
// 스킨은 이제 **구도(layout: frontview|sideview) + HUD(hudTemplate) + 색(themeVars)** 의 조합이다.
// 구도는 `_rm2000.css`(정면)·`_rm2003.css`(측면)가 `data-battle-layout` 으로, HUD·색은 `_glass-variants.css` 가 맡는다.
// 배치는 battlerPlacements.ts 가 구도에서 파생한다. 라벨에 구도를 적는다(정면/측면).
//
// 2026-08-21: 라벨 전부 교체 완료. 예전에는 타사 프랜차이즈 이름을 그대로 썼다.
// 라벨은 이제 **창 색 + 레이아웃/HUD 특징**을 말하고 서로 구분된다:
//   흰 창·박스 HUD / 유리 창·정면 필드 / 유리 창·측면 필드 / 먹빛 창·최소 HUD /
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
    id: "rm2000", defaultBackdropResourceId: "battle-skin-rm2003-backdrop", label: "유리 창 · 정면 필드 (기본)", layout: "frontview", showAllySprites: false,
    hudTemplate: "rows", transition: "wipe-blue", family: "glass",
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
  // 측면 전투(rm2003): 적은 필드 왼쪽 두 줄, 아군은 오른쪽 사선 열에 전투 시트(48px 셀, 고해상도 짝)로
  // 서서 서로 마주 본다. 창 크롬은 rm2000 과 같은 유리 카드(family: glass) — 구도만 다르고 HUD 는 같다.
  // 배경은 정면과 같은 하늘 배경을 쓴다(측면 구도 전용 배경은 아직 없다).
  rm2003: {
    id: "rm2003", defaultBackdropResourceId: "battle-skin-rm2003-backdrop", label: "유리 창 · 측면 필드", layout: "sideview", showAllySprites: true,
    hudTemplate: "rows", transition: "wipe-blue", family: "glass",
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
    id: "octopath", defaultBackdropResourceId: "battle-skin-octopath-backdrop", label: "먹빛 창 · 측면 · 얇은 HUD", layout: "sideview", showAllySprites: true,
    hudTemplate: "minimal", transition: "focus-blur", family: "glass",
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
    id: "chrono", defaultBackdropResourceId: "battle-skin-chrono-backdrop", label: "청람 창 · 측면 · 링 게이지", layout: "sideview", showAllySprites: true,
    hudTemplate: "ring", transition: "sweep-cyan", family: "glass",
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
    id: "bravely", defaultBackdropResourceId: "battle-skin-bravely-backdrop", label: "세피아 창 · 측면 · 얇은 HUD", layout: "sideview", showAllySprites: true,
    hudTemplate: "minimal", transition: "brave-shift", family: "glass",
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
    id: "dragonquest", defaultBackdropResourceId: "battle-skin-dragonquest-backdrop", label: "검은 창 · 정면 · 흰 테두리", layout: "frontview", showAllySprites: false,
    hudTemplate: "rows", transition: "curtain-dq", family: "glass",
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
    id: "ff", defaultBackdropResourceId: "battle-skin-ff-backdrop", label: "코발트 창 · 측면 · 흰 테두리", layout: "sideview", showAllySprites: true,
    hudTemplate: "rows", transition: "wipe-blue", family: "glass",
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
    id: "mother", defaultBackdropResourceId: "battle-skin-mother-backdrop", label: "암전 창 · 정면 · 형광 분홍", layout: "frontview", showAllySprites: false,
    hudTemplate: "rows", transition: "psychedelic", family: "glass",
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
    id: "goldensun", defaultBackdropResourceId: "battle-skin-goldensun-backdrop", label: "금갈색 창 · 측면 · 얼굴 카드", layout: "sideview", showAllySprites: true,
    hudTemplate: "boxes", transition: "sweep-cyan", family: "glass",
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
    id: "mv", defaultBackdropResourceId: "battle-skin-mv-backdrop", label: "밝은 창 · 정면 필드", layout: "frontview", showAllySprites: false,
    hudTemplate: "rows", transition: "fade", family: "glass",
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
    id: "vxace", defaultBackdropResourceId: "battle-skin-vxace-backdrop", label: "심야 창 · 정면 · 얼굴 카드", layout: "frontview", showAllySprites: false,
    hudTemplate: "boxes", transition: "fade", family: "glass",
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
  // 도트 측면 전투(2026-09-28): 청색 그라데이션 픽셀 창, 겹 배경(scenery), 전진 걸음·적 점멸 연출(motionStyle).
  // 창 크롬은 유리 뼈대(family glass)의 배치 계약을 그대로 쓰고 모양만 _retro2003.css 가 덮는다.
  retro2003: {
    id: "retro2003", defaultBackdropResourceId: "battle-skin-rm2003-backdrop", label: "레트로 2003 · 측면 도트 전투", layout: "sideview", showAllySprites: true,
    hudTemplate: "rows", transition: "shatter-2003", family: "glass", motionStyle: "retro", scenery: "layered",
    themeVars: {
      "--battle-window-bg": "#18248c",
      "--battle-window-edge": "#d8e0ff",
      "--battle-window-inner": "#0c1458",
      "--battle-text": "#ffffff",
      "--battle-text-muted": "#a8b8f0",
      "--battle-accent": "#ffe060",
      "--battle-accent-soft": "rgba(255,224,96,.2)",
      "--battle-hp-high": "#58e070",
      "--battle-hp-mid": "#f0d040",
      "--battle-hp-low": "#f05040",
      "--battle-shadow": "0 2px 0 rgba(0,0,0,.6)",
      "--battle-cursor": "#ffe060",
      "--battle-backdrop-filter": "none",
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

/**
 * 새 저작 UI 가 노출하는 스킨 — 12종 전부(2026-09-25).
 * 9종은 2026-08-28 에 지원 종료였다가, 각자 CSS 를 버리고 유리 뼈대(family glass: 정면 rm2000 ·
 * 측면 rm2003 의 배치·HUD·연출) 위의 **색 + HUD 변형**으로 흡수해 되살렸다. 순서는 드롭다운 순서다 —
 * 기본 셋을 앞에 두고, 그 뒤는 정면 → 측면.
 */
export const ACTIVE_BATTLE_SKIN_IDS: readonly BattleSkinId[] = [
  "rm2000", "rm2003", "pokemon", "retro2003",
  "vxace", "dragonquest", "mother", "mv",
  "ff", "goldensun", "chrono", "octopath", "bravely",
];

/** 드롭다운 순서의 활성 스킨. deprecated 표식이 붙은 스킨은 빠진다(지금은 없다). */
export function listActiveBattleSkinIds(): BattleSkinId[] {
  return ACTIVE_BATTLE_SKIN_IDS.filter((id) => !BATTLE_SKINS[id].deprecated);
}

export function isDeprecatedBattleSkin(id: BattleSkinId): boolean {
  return BATTLE_SKINS[id].deprecated === true;
}

/** 루트 `data-battle-skin-family` 값 — 묶음이 없는 스킨은 자기 id 다. */
export function battleSkinFamily(id: BattleSkinId): string {
  return BATTLE_SKINS[id].family ?? id;
}

/** 미설정/미지의 값이 떨어지는 기본 스킨. */
export const DEFAULT_BATTLE_SKIN_ID: BattleSkinId = "rm2000";

/** 저장 데이터에 남아 있을 수 있는 옛 정면 전투 스킨 id → 현재 id.
 *  `rm2003` 은 2026-09-03 오전에 rm2000 으로 풀렸지만 같은 날 측면 스킨으로 되살아나 여기서 빠졌다. */
const LEGACY_SKIN_ALIASES: Readonly<Record<string, BattleSkinId>> = {
  classic: "rm2000", // 2026-08 이전 별칭
};

/** legacy(`classic`/`pokemon`/undefined) 및 임의 문자열을 유효 스킨 id로 정규화한다.
 *  미설정(undefined)은 기본 스킨(rm2000)으로, legacy `classic` 은 rm2000 으로 푼다. */
export function resolveSkinId(legacy: string | undefined): BattleSkinId {
  if (legacy === "pokemon") return "pokemon";
  if (!legacy) return DEFAULT_BATTLE_SKIN_ID;
  const alias = LEGACY_SKIN_ALIASES[legacy];
  if (alias) return alias;
  return VALID_IDS.has(legacy as BattleSkinId) ? (legacy as BattleSkinId) : DEFAULT_BATTLE_SKIN_ID;
}

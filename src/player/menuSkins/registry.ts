// player/menuSkins/registry.ts — ESC(X) 게임 메뉴 스킨 레지스트리.
//
// 전투 스킨(battle/skins/registry.ts)과 같은 골격이다: `id` 는 프로젝트 파일(system.menuUiStyle)에
// 저장되므로 함부로 바꾸지 않고, `label` 은 자료집 → 시스템 → 화면 절 드롭다운에 그대로 보인다.
// 라벨은 그 스킨이 실제로 어떻게 보이는지(첫 화면 · 배치 · 톤)를 말하고 타사 프랜차이즈 이름을
// 쓰지 않는다(test/detsukuruBrandStrings.test.ts 규약).
//
// 스킨은 DOM 골격을 바꾸지 않는다 — 렌더러(playerStatusMenu.ts)가 루트에 data-menu-skin-* 속성을 쓰고
// CSS(styles/runtime/statusMenuSkins.css)가 그 속성으로 배치·색·아이콘을 바꾼다. 렌더러가 갈라지는 곳은
// 첫 화면(landing)·사이드 파티·허브 요약 세 군데뿐이다. 설계: docs/superpowers/specs/2026-09-17-esc-menu-skins-design.md
import type { Project } from "@/project/types";
import type { MenuSkin, MenuSkinId } from "@/player/menuSkins/types";

export const MENU_SKINS: Record<MenuSkinId, MenuSkin> = {
  workbench: {
    id: "workbench",
    label: "작업대 · 아이템 첫 화면",
    description: "왼쪽 명령 레일, 오른쪽 작업 패널. ESC 직후 아이템 목록이 보입니다.",
    landing: "work", tone: "glass", railIcons: "glyph", railStyle: "collapsed", railColumns: 1, sideParty: false,
  },
  "party-first": {
    id: "party-first",
    label: "파티 퍼스트 · 유리",
    description: "ESC 직후 파티 4명의 HP·MP 가 보입니다. 컬러 아이콘 레일, 작업 패널 옆 파티 미니.",
    landing: "party", tone: "glass", railIcons: "painted", railStyle: "flat", railColumns: 1, sideParty: true,
  },
  "party-first-warm": {
    id: "party-first-warm",
    label: "파티 퍼스트 · 남색과 금",
    description: "파티 퍼스트와 같은 배치를 남색 표면과 금빛 커서로 그립니다.",
    landing: "party", tone: "warm", railIcons: "painted", railStyle: "flat", railColumns: 1, sideParty: true,
  },
  hub: {
    id: "hub",
    label: "허브 타일 · 요약 6칸",
    description: "명령 6개를 요약이 붙은 큰 타일로 펼치고, 아래에 파티 스트립을 둡니다.",
    landing: "hub", tone: "glass", railIcons: "painted", railStyle: "collapsed", railColumns: 3, sideParty: true,
  },
  sheet: {
    id: "sheet",
    label: "사이드 시트 · 지도 노출",
    description: "오른쪽 시트만 뜨고 주인공과 지도가 그대로 보입니다. 파티가 위, 명령 격자가 아래.",
    landing: "sheet", tone: "glass", railIcons: "painted", railStyle: "flat", railColumns: 2, sideParty: true,
  },
};

/** 미설정·미지값이 떨어지는 기본 스킨 = 지금 화면. */
export const DEFAULT_MENU_SKIN_ID: MenuSkinId = "workbench";

export function listMenuSkinIds(): MenuSkinId[] {
  return Object.keys(MENU_SKINS) as MenuSkinId[];
}

export function isMenuSkinId(value: unknown): value is MenuSkinId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MENU_SKINS, value);
}

export function resolveMenuSkinId(value: string | undefined): MenuSkinId {
  return isMenuSkinId(value) ? value : DEFAULT_MENU_SKIN_ID;
}

export function menuSkinFor(project: Project): MenuSkin {
  return MENU_SKINS[resolveMenuSkinId(project.system.menuUiStyle)];
}

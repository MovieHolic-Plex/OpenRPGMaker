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
  // 기본 스킨(2026-09-28). 상점 기본 프리셋 "pixel" 과 같은 도트 창 — 걷는 파티, HP·MP·EXP 숫자와 막대,
  // 손가락 커서, 오른쪽 명령·소지금·장소 창. 장비·아이템 화면은 「현재 → 변경 후 ▲▼」 로 증감을 보인다.
  pixel: {
    id: "pixel",
    label: "도트 창 · 파티 수치",
    description: "청색 도트 창에 파티 네 명이 걷고 HP·MP·EXP 를 숫자로 보여 줍니다. 장비·아이템은 바뀌는 수치를 ▲▼ 로 미리 보입니다.",
    landing: "party", tone: "glass", railIcons: "glyph", railStyle: "collapsed", railColumns: 1, sideParty: false,
    partyArt: "character", partyStats: true,
  },
  "field-list": {
    id: "field-list", label: "여행 · 세로 명령창", description: "지도를 남겨두고 오른쪽 밝은 창에서 명령을 고릅니다. 방향키 위·아래로 이동합니다.",
    landing: "sheet", tone: "glass", railIcons: "glyph", railStyle: "flat", railColumns: 1, sideParty: false,
  },
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
  classic: {
    id: "classic",
    label: "클래식 · 청색 창",
    description: "청색 창과 밝은 이중 테두리. 왼쪽 명령과 오른쪽 파티를 분리한 고전적인 메뉴입니다.",
    landing: "party", tone: "glass", railIcons: "glyph", railStyle: "collapsed", railColumns: 1, sideParty: false,
  },
  journal: {
    id: "journal",
    label: "여행 수첩 · 종이와 잉크",
    description: "밝은 종이 위 파티 기록과 오른쪽 책갈피 명령. 여행 수첩처럼 펼쳐지는 메뉴입니다.",
    landing: "party", tone: "glass", railIcons: "glyph", railStyle: "collapsed", railColumns: 1, sideParty: false,
  },
  ribbon: {
    id: "ribbon",
    label: "하단 바 · 파티 카드",
    description: "파티를 네 장의 카드로 펼치고 아래 가로 명령 바를 좌우로 이동합니다. Enter로 선택합니다.",
    landing: "party", tone: "glass", railIcons: "painted", railStyle: "collapsed", railColumns: 6, sideParty: false,
  },
  "retro-2000": {
    id: "retro-2000",
    label: "레트로 2000 · 청색 픽셀 창",
    description: "짙은 청색과 각진 이중 테두리. 왼쪽 파티의 체력·마력을 숫자로 읽고 오른쪽에서 명령을 고릅니다.",
    landing: "party", tone: "glass", railIcons: "glyph", railStyle: "collapsed", railColumns: 1, sideParty: false,
  },
  "retro-2003": {
    id: "retro-2003",
    label: "레트로 2003 · 청록 입체 창",
    description: "청록빛 표면과 은색 입체 테두리. 왼쪽 파티와 오른쪽 명령·소지금 창을 분리합니다.",
    landing: "party", tone: "glass", railIcons: "glyph", railStyle: "collapsed", railColumns: 1, sideParty: false,
  },
  "classic-xp": {
    id: "classic-xp",
    label: "클래식 XP · 안개빛 창",
    description: "지도 위 반투명 회청색 창. 작은 보행 캐릭터와 숫자 상태표, 왼쪽 명령과 시간·소지금 창을 배치합니다.",
    landing: "party", tone: "glass", railIcons: "glyph", railStyle: "collapsed", railColumns: 1, sideParty: false,
    partyArt: "character",
  },
  "classic-vx": {
    id: "classic-vx",
    label: "클래식 VX · 보랏빛 초상 창",
    description: "보랏빛 유리창과 둥근 흰 테두리. 큰 얼굴 초상, 색상 게이지, 왼쪽 명령·소지금 창으로 구성합니다.",
    landing: "party", tone: "glass", railIcons: "glyph", railStyle: "collapsed", railColumns: 1, sideParty: false,
  },

};

/** 미설정·미지값이 떨어지는 기본 스킨. 2026-09-28 에 workbench → pixel(상점 기본 프리셋과 같은 도트 창). */
export const DEFAULT_MENU_SKIN_ID: MenuSkinId = "pixel";

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
  const hudMenu = project.system.fieldHud?.menuStyle;
  return MENU_SKINS[resolveMenuSkinId(hudMenu && hudMenu !== "project" ? hudMenu : project.system.menuUiStyle)];
}

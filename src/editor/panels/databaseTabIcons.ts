// 데이터베이스 사이드바 레일 아이콘 — 30개 탭의 SVG 선 아이콘 세트.
//
// 왜 CSS 가 아니라 여기인가 (실측):
//   전에는 글리프가 `sidebar.css` 의 per-testid 규칙 24줄(`content: "<유니코드 글리프>" !important`)이었다.
//   1) 30개 탭 중 24개만 규칙이 있어서 생활 탭 5개(생활 기술·계절·동물·농장 건물·낚시)는
//      `content: attr(data-short)` 폴백으로 떨어져 **한글 첫 글자**가 아이콘 자리에 떴다.
//      레지스트리에 탭을 추가하면서 CSS 를 잊는 걸 막을 장치가 없었다.
//   2) `system-studio.css` 가 같은 `::before` 를 `content: none !important` 로 덮어서
//      시스템 탭을 열면 1100px 이상에서 레일 아이콘이 전부 사라졌다.
//   3) 세트에 계열이 없었다 — 체스 기물 · 기하 도형 · 맥 커맨드키 · 텍스트("Aa") 가
//      섞이고, `"Segoe UI Symbol"` 폴백이라 Windows 밖에서 굵기·베이스라인이 제각각이었다.
//      (그 글리프를 여기 인용하지 않는다 — 이 파일은 픽토그래프 0개가 계약이다.)
//
// `Record<DatabaseTab, ...>` 로 못 박았으므로 이제 탭을 추가하면서 아이콘을 빼먹으면
// **타입 에러**다. (1)은 구조적으로 재발할 수 없다.
//
// 규격은 `tileToolbarIcons.ts` 와 공유한다 — 22×22 viewBox, stroke currentColor 1.8,
// round cap/join. 색은 CSS 가 `.db-tab-icon { color }` 로 준다.
import type { DatabaseTab } from "@/editor/panels/database";
import { buildSvgIcon, type SvgNodeSpec } from "@/editor/panels/tileToolbarIcons";

/** 전투 애니메이션 — 레일은 `animations`, 레코드 경로는 `battleAnimations` 로 같은 탭을
 *  가리킨다(`renderActiveTab`). 두 키가 같은 그림을 쓰도록 스펙을 공유한다. */
const ANIMATION_NODES: readonly SvgNodeSpec[] = [
  { tag: "path", attrs: { d: "M11 2.9l1.6 4 4-1.6-1.6 4 4 1.6-4 1.6 1.6 4-4-1.6-1.6 4-1.6-4-4 1.6 1.6-4-4-1.6 4-1.6-1.6-4 4 1.6z" } },
  { tag: "circle", attrs: { cx: "11", cy: "11", r: "2.4" } },
];

const TAB_ICONS: Record<DatabaseTab, readonly SvgNodeSpec[]> = {
  // 그룹 밖 고정 — 대시보드 격자
  overview: [
    { tag: "rect", attrs: { x: "3.6", y: "3.6", width: "6", height: "6", rx: "1.4" } },
    { tag: "rect", attrs: { x: "12.4", y: "3.6", width: "6", height: "6", rx: "1.4" } },
    { tag: "rect", attrs: { x: "3.6", y: "12.4", width: "6", height: "6", rx: "1.4" } },
    { tag: "rect", attrs: { x: "12.4", y: "12.4", width: "6", height: "6", rx: "1.4" } },
  ],

  // ── 파티 ──
  // 주인공 — 인물
  actors: [
    { tag: "circle", attrs: { cx: "11", cy: "7.4", r: "3.2" } },
    { tag: "path", attrs: { d: "M4.6 18.4c0-3.5 2.9-5.4 6.4-5.4s6.4 1.9 6.4 5.4" } },
  ],
  // 직업 — 방패
  classes: [
    { tag: "path", attrs: { d: "M11 3.2l6.6 2.4v5.3c0 4-2.8 6.7-6.6 8.1-3.8-1.4-6.6-4.1-6.6-8.1V5.6z" } },
  ],
  // 스킬 — 4점 스파클
  skills: [
    { tag: "path", attrs: { d: "M10 3.2l1.7 4.6 4.6 1.7-4.6 1.7L10 15.8 8.3 11.2 3.7 9.5l4.6-1.7z" } },
    { tag: "path", attrs: { d: "M16.6 13.4v4.4M14.4 15.6h4.4" } },
  ],
  // 아이템 — 상자
  items: [
    { tag: "rect", attrs: { x: "3.4", y: "5.8", width: "15.2", height: "12.4", rx: "1.6" } },
    { tag: "path", attrs: { d: "M3.4 10.2h15.2" } },
    { tag: "path", attrs: { d: "M11 10.2v8" } },
  ],
  // 장비 — 검
  equipment: [
    { tag: "path", attrs: { d: "M11 2.8v10.3" } },
    { tag: "path", attrs: { d: "M6.7 13.1h8.6" } },
    { tag: "path", attrs: { d: "M11 15.3v3.9" } },
  ],

  // ── 몬스터 ──
  // 몬스터 — 뿔 달린 두상
  enemies: [
    { tag: "path", attrs: { d: "M5.8 12.2a5.2 5.2 0 0 1 10.4 0v2.4a3.2 3.2 0 0 1-3.2 3.2H9a3.2 3.2 0 0 1-3.2-3.2z" } },
    { tag: "path", attrs: { d: "M6.7 8.4 4.1 5.1M15.3 8.4l2.6-3.3" } },
    { tag: "path", attrs: { d: "M9.2 12.1v.9M12.8 12.1v.9" } },
  ],
  // 몬스터 종족 — 발자국
  monsterSpecies: [
    { tag: "path", attrs: { d: "M11 12.1c2.4 0 4.3 1.8 4.3 3.7 0 1.5-1.2 2.5-2.6 2.5H9.3c-1.4 0-2.6-1-2.6-2.5 0-1.9 1.9-3.7 4.3-3.7z" } },
    { tag: "circle", attrs: { cx: "7.2", cy: "8.6", r: "1.7" } },
    { tag: "circle", attrs: { cx: "11", cy: "6.2", r: "1.7" } },
    { tag: "circle", attrs: { cx: "14.8", cy: "8.6", r: "1.7" } },
  ],
  // 적 그룹 — 겹친 셋
  troops: [
    { tag: "circle", attrs: { cx: "7.9", cy: "8.3", r: "3.4" } },
    { tag: "circle", attrs: { cx: "14.1", cy: "8.3", r: "3.4" } },
    { tag: "circle", attrs: { cx: "11", cy: "14.2", r: "3.4" } },
  ],
  // 진영 — 깃대에 걸린 깃발
  factions: [
    { tag: "path", attrs: { d: "M6.4 3.6v14.8" } },
    { tag: "path", attrs: { d: "M6.4 4.6h9.8l-2.3 3.2 2.3 3.2H6.4z" } },
  ],

  // ── 전투 규칙 ──
  // 속성 — 불꽃 + 물방울
  elements: [
    { tag: "path", attrs: { d: "M9.2 18.4c-2.6-1-4.2-3.1-4.2-5.5 0-3.5 4.1-4.5 4.1-9.3 2.7 1.6 4.6 4.5 4.6 7.1 0 .9-.3 1.7-.8 2.4" } },
    { tag: "path", attrs: { d: "M15.6 12.4c1.6 1.8 2.5 3 2.5 4.1a2.5 2.5 0 0 1-5 0c0-1.1.9-2.3 2.5-4.1z" } },
  ],
  // 상태 — 영향받은 표식(원 안의 번개)
  states: [
    { tag: "circle", attrs: { cx: "11", cy: "11", r: "7.3" } },
    { tag: "path", attrs: { d: "M11.9 6.6 8.5 11.6h3l-.8 3.8 3.4-4.9h-3z" } },
  ],
  // 전투 애니메이션 — 충격 폭발
  animations: ANIMATION_NODES,
  battleAnimations: ANIMATION_NODES,
  // 전투 화면 — 모니터
  battleScreen: [
    { tag: "rect", attrs: { x: "2.9", y: "4.4", width: "16.2", height: "11", rx: "1.9" } },
    { tag: "path", attrs: { d: "M11 15.4v3.1" } },
    { tag: "path", attrs: { d: "M7.9 18.5h6.2" } },
  ],
  // 전투 명령 — 명령 커서 + 목록
  battleCommands: [
    { tag: "path", attrs: { d: "M3.4 4.9 6.6 7.6 3.4 10.3z" } },
    { tag: "path", attrs: { d: "M9.2 6.6h9.4M9.2 11h9.4M9.2 15.4h9.4" } },
  ],

  // ── 생활 ──
  // 농사·작물 — 새싹
  crops: [
    { tag: "path", attrs: { d: "M11 18.6v-7.2" } },
    { tag: "path", attrs: { d: "M11 11.4c0-3 2.2-5.1 5.3-5.1 0 3.1-2.2 5.1-5.3 5.1z" } },
    { tag: "path", attrs: { d: "M11 13.6c0-2.5-1.9-4.3-4.5-4.3 0 2.6 1.9 4.3 4.5 4.3z" } },
  ],
  // 주민 관계 — 두 사람 + 마음
  characters: [
    { tag: "circle", attrs: { cx: "6.9", cy: "7.2", r: "2.8" } },
    { tag: "circle", attrs: { cx: "15.1", cy: "7.2", r: "2.8" } },
    { tag: "path", attrs: { d: "M11 18.4c-2.3-1.7-3.7-3-3.7-4.5a2 2 0 0 1 3.7-1 2 2 0 0 1 3.7 1c0 1.5-1.4 2.8-3.7 4.5z" } },
  ],
  // 생활 기술·제작 — 망치
  lifeCrafting: [
    { tag: "path", attrs: { d: "M4.3 18.7 12.4 10.6" } },
    { tag: "path", attrs: { d: "M11 7.4l3.5-3.5 4.8 4.8-3.5 3.5z" } },
  ],
  // 계절·날씨 — 해 + 구름
  dailyWeather: [
    { tag: "circle", attrs: { cx: "7.7", cy: "7.4", r: "3.1" } },
    { tag: "path", attrs: { d: "M7.7 2.6v1.3M7.7 10.9v1.3M2.9 7.4h1.3M11.2 7.4h1.3" } },
    { tag: "path", attrs: { d: "M9.6 18.6h7.1a2.9 2.9 0 0 0 .3-5.8 4 4 0 0 0-7.6-.9 3.4 3.4 0 0 0 .2 6.7z" } },
  ],
  // 동물·축사 — 귀 달린 머리
  farmAnimals: [
    { tag: "path", attrs: { d: "M6.4 9.6h9.2v3.9a4.6 4.6 0 0 1-9.2 0z" } },
    { tag: "path", attrs: { d: "M6.4 9.6C4.9 9.6 3.4 8 3.4 6c2.2 0 3.7 1.4 4 3.1M15.6 9.6c1.5 0 3-1.6 3-3.6-2.2 0-3.7 1.4-4 3.1" } },
    { tag: "path", attrs: { d: "M9.2 12.4v.9M12.8 12.4v.9" } },
  ],
  // 농장 건물·집 꾸미기 — 집
  farmSpatial: [
    { tag: "path", attrs: { d: "M3.4 10.1 11 3.9l7.6 6.2" } },
    { tag: "path", attrs: { d: "M5.4 10.3v8.3h11.2v-8.3" } },
    { tag: "path", attrs: { d: "M9.4 18.6v-4.6h3.2v4.6" } },
  ],
  // 낚시·채집·박물관 — 물고기
  lifeCollections: [
    { tag: "path", attrs: { d: "M6.6 11c2-3.2 4.6-4.9 7-4.9 2.9 0 4.9 2.1 5.8 4.9-.9 2.8-2.9 4.9-5.8 4.9-2.4 0-5-1.7-7-4.9z" } },
    { tag: "path", attrs: { d: "M6.6 11 3.1 7.7v6.6z" } },
    { tag: "circle", attrs: { cx: "15.4", cy: "9.7", r: "0.9" } },
  ],

  // ── 세계 ──
  // 생성 규칙 — 물결 위 나무(지형을 깔아 주는 규칙)
  worldGen: [
    { tag: "path", attrs: { d: "M2.8 15.6c1.6-1.5 3.2-1.5 4.8 0s3.2 1.5 4.8 0 3.2-1.5 4.8 0" } },
    { tag: "path", attrs: { d: "M2.8 18.6c1.6-1.5 3.2-1.5 4.8 0s3.2 1.5 4.8 0 3.2-1.5 4.8 0" } },
    { tag: "path", attrs: { d: "M7.6 11.8 4.4 11.8 7.6 3.4 10.8 11.8z" } },
    { tag: "path", attrs: { d: "M14.6 11.8a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6z" } },
  ],
  // 타일셋 — 3×3 격자
  tilesets: [
    { tag: "rect", attrs: { x: "3.4", y: "3.4", width: "15.2", height: "15.2", rx: "1.6" } },
    { tag: "path", attrs: { d: "M8.5 3.4v15.2M13.5 3.4v15.2M3.4 8.5h15.2M3.4 13.5h15.2" } },
  ],
  // 구조물 — 쌓은 블록(아이소 큐브)
  structureKits: [
    { tag: "path", attrs: { d: "M11 2.9l7 4v8.2l-7 4-7-4V6.9z" } },
    { tag: "path", attrs: { d: "M4 6.9 11 10.9 18 6.9" } },
    { tag: "path", attrs: { d: "M11 10.9v8.2" } },
  ],
  // 지형 — 산
  terrain: [
    { tag: "path", attrs: { d: "M2.6 17.4l5.5-8.5 4 6" } },
    { tag: "path", attrs: { d: "M11.9 17.4l3.6-5.6 3.9 5.6" } },
    { tag: "path", attrs: { d: "M2.6 17.4h16.8" } },
  ],
  // 공용 이벤트 — 분기 노드
  commonEvents: [
    { tag: "circle", attrs: { cx: "5.4", cy: "11", r: "2.2" } },
    { tag: "circle", attrs: { cx: "16.6", cy: "5.6", r: "2.2" } },
    { tag: "circle", attrs: { cx: "16.6", cy: "16.4", r: "2.2" } },
    { tag: "path", attrs: { d: "M7.5 10.1 14.5 6.5M7.5 11.9l7 3.6" } },
  ],

  // ── 시스템 ──
  // 시스템 — 슬라이더
  system: [
    { tag: "path", attrs: { d: "M3.4 6.6h15.2M3.4 11h15.2M3.4 15.4h15.2" } },
    { tag: "circle", attrs: { cx: "8.1", cy: "6.6", r: "1.9" } },
    { tag: "circle", attrs: { cx: "14.2", cy: "11", r: "1.9" } },
    { tag: "circle", attrs: { cx: "9.6", cy: "15.4", r: "1.9" } },
  ],
  // 용어 — 펼친 책
  terms: [
    { tag: "path", attrs: { d: "M11 6.4v11.2" } },
    { tag: "path", attrs: { d: "M11 6.4C9.3 5.1 6.9 4.5 4 4.5v10.7c2.9 0 5.3.6 7 1.9" } },
    { tag: "path", attrs: { d: "M11 6.4c1.7-1.3 4.1-1.9 7-1.9v10.7c-2.9 0-5.3.6-7 1.9" } },
  ],
  // 스위치 — 토글
  switches: [
    { tag: "rect", attrs: { x: "2.8", y: "6.9", width: "16.4", height: "8.2", rx: "4.1" } },
    { tag: "circle", attrs: { cx: "14.6", cy: "11", r: "2.4" } },
  ],
  // 변수 — 중괄호 한 쌍
  variables: [
    { tag: "path", attrs: { d: "M8.6 4.4c-2 0-1.7 4.1-1.7 5.1 0 1-.6 1.5-2.3 1.5 1.7 0 2.3.5 2.3 1.5 0 1-.3 5.1 1.7 5.1" } },
    { tag: "path", attrs: { d: "M13.4 4.4c2 0 1.7 4.1 1.7 5.1 0 1 .6 1.5 2.3 1.5-1.7 0-2.3.5-2.3 1.5 0 1 .3 5.1-1.7 5.1" } },
  ],
};

/** 사이드바 탭 버튼 안에 넣을 아이콘. `aria-hidden` 이라 버튼의 접근 가능한 이름은
 *  라벨 텍스트가 그대로 소유한다(`title` === `aria-label` === `textContent` 계약). */
export function makeDatabaseTabIcon(tab: DatabaseTab): SVGSVGElement {
  const svg = buildSvgIcon(TAB_ICONS[tab]);
  svg.setAttribute("class", "db-tab-icon");
  return svg;
}

export const DATABASE_TAB_ICON_IDS = Object.keys(TAB_ICONS) as readonly DatabaseTab[];

export { TAB_ICONS as DATABASE_TAB_ICONS };

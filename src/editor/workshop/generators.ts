// src/editor/workshop/generators.ts
/**
 * 공방 첫 화면의 생성기 카드 넷(2026-10-21 사용자 결정: 하네스 목록을 빼고 char-gen·object-gen·tile-gen·item-gen 과 잇는다).
 * 화면 글은 쉬운 말만 — 모델 이름·내부 용어를 쓰지 않는다. 상태는 정직하게:
 * - object-gen: 편집기 안에서 사용자 자기 AI 계정으로 그린다(공방 실행기). object-gen 이 만든 묶음도 가져온다.
 * - char-gen: 파이썬 도구라 브라우저에서 못 돈다 → 사용자 컴퓨터의 AI 에이전트에게 부탁할 글을 만들어 주고, 결과 묶음을 가져온다.
 * - tile-gen: 지형 생성기(2026-10-21 다시 만듦) — 이음매 없는 바닥·자동 타일 가장자리(47칸)·물가·움직이는 물·숲 덩어리·절벽.
 *   물건·기물·건물은 object-gen 만 그린다 — tile-gen 을 물건 생성기로 소개하지 않는다. char-gen 처럼 부탁 글 + 묶음 가져오기.
 *   묶음은 `oprn-store-pack/1` tileset 하나 + autotileGroups(·animationStrips) — 가져오기가 그대로 보존한다.
 * - item-gen: 저장소가 없다(2026-10-21 조직·홈 확인) → 「준비 중」. 가짜로 채우지 않는다.
 * 견본 그림(sample)은 그 생성기가 실제로 만든 그림이다: object-gen 은 그 저장소 docs/images/hero.png 의 고른 기물,
 * char-gen 은 그 저장소의 자체 더미 칩(examples/bases/dummy_*)과 같은 칩의 편집 결과, tile-gen 은 풀밭 채우기 실제 출력(사람 선택 전).
 * 제3자 그림은 쓰지 않는다.
 */
import { getLocale } from "@/i18n";

export type GeneratorId = "char-gen" | "object-gen" | "tile-gen" | "item-gen";
/** ready = 편집기 안에서 만든다 · local = 내 컴퓨터에서 만들어 가져온다 · next = 다시 만드는 중, 곧 · soon = 준비 중 */
export type GeneratorStatus = "ready" | "local" | "next" | "soon";

export interface WorkshopGenerator {
  readonly id: GeneratorId;
  readonly title: string;
  /** 무엇을 만드는가 — 한 줄 */
  readonly makes: string;
  readonly status: GeneratorStatus;
  /** 그 생성기가 실제로 만든 견본 그림(원래 크기 도트, 화면에서 정수 배율로 키운다). 없으면 견본 자리만 비워 둔다. */
  readonly sample?: { readonly src: string; readonly width: number; readonly height: number; readonly alt: string; readonly caption?: string };
}

export const WORKSHOP_GENERATORS: readonly WorkshopGenerator[] = [
  {
    id: "object-gen", title: "물건·가구", status: "ready",
    makes: "가구·상자·표지판 같은 물건을 지금 맵의 그림 느낌에 맞춰 그려요.",
    sample: { src: "/assets/workshop/object-gen-sample.png", width: 124, height: 58, alt: "물건 생성기가 그린 진열장·냉장고·보관함" },
  },
  {
    id: "char-gen", title: "캐릭터", status: "local",
    makes: "걷는 캐릭터의 옷·머리·색을 바꿔 새 사람을 만들어요.",
    sample: { src: "/assets/workshop/char-gen-sample.png", width: 124, height: 58, alt: "캐릭터 생성기가 옷을 바꾼 전후 두 쌍" },
  },
  {
    id: "tile-gen", title: "지형·바닥", status: "local", makes: "이음매 없는 바닥, 물가·절벽 가장자리, 칠해 넣는 숲과 물을 내 타일셋 색으로 그려요.",
    // tile-gen 실제 결과(작업 floor5 후보 A, 버들항 풀밭 채우기). 독립 검수는 아슬아슬 통과, 사람이 고른 것은 아니다 —
    // 승인·선택된 그림처럼 보이지 않게 「견본 출력」 표를 단다(2026-10-21 tile-gen 쪽 요청). 길·물·숲은 아직 검수 불통과라 싣지 않는다.
    sample: { src: "/assets/workshop/tile-gen-sample.png", width: 124, height: 58, alt: "지형 생성기가 그린 풀밭 바닥 견본(사람이 고르지 않은 출력)", caption: "견본 출력" },
  },
  { id: "item-gen", title: "아이템 아이콘", status: "soon", makes: "물약·열쇠·무기 같은 아이템 아이콘을 그려 줄 거예요." },
];

export const GENERATOR_STATUS_LABELS: Readonly<Record<GeneratorStatus, string>> = {
  ready: "여기서 바로",
  local: "내 컴퓨터에서",
  next: "곧 나와요",
  soon: "준비 중",
};

/** char-gen 은 공개 저장소다. object-gen·tile-gen 은 비공개라 설치 링크를 내지 않는다. */
export const CHAR_GEN_REPO_URL = "https://github.com/MovieHolic-Plex/char-gen";

/**
 * 사용자 컴퓨터의 AI 에이전트(자기 로그인)에게 붙여 넣을 부탁 글. 에이전트에게 가는 글이라 화면 번역 대상이 아니므로
 * 지금 언어로 직접 만든다. char-gen 스킬이 깔려 있으면 에이전트가 단계(만들기·검사·사람 고르기·묶기)를 알아서 한다.
 */
export function charGenRequest(what: string, count: number): string {
  const subject = what.trim() || defaultWhat();
  const n = Math.max(1, Math.min(4, Math.round(count) || 1));
  switch (getLocale()) {
    case "en": return `Use char-gen to make ${n} walking character chip(s): "${subject}". When they pass the check and I have picked, run char-gen pack to make a pack folder I can import into the OPRN editor.`;
    case "ja": return `char-gen で歩行キャラチップを ${n} 体作って:「${subject}」。チェックを通って私が選んだら、char-gen pack で OPRN エディターに取り込めるパックフォルダを作って。`;
    case "zh": return `用 char-gen 做 ${n} 个行走角色小图:「${subject}」。通过检查并由我挑选后,用 char-gen pack 打包成可导入 OPRN 编辑器的文件夹。`;
    default: return `char-gen 으로 걷는 캐릭터 칩을 ${n}개 만들어 줘: 「${subject}」. 검사를 통과하고 내가 고르면 char-gen pack 으로 OPRN 에디터에 가져올 묶음 폴더를 만들어 줘.`;
  }
}

function defaultWhat(): string {
  switch (getLocale()) {
    case "en": return "a harbor sailor in a blue coat";
    case "ja": return "青いコートの港の船乗り";
    case "zh": return "穿蓝色外套的港口水手";
    default: return "파란 외투를 입은 항구 선원";
  }
}

/** tile-gen 지형 종류 — CLI `tile-gen new --mode` 값과 화면 이름. */
export type TerrainMode = "floor" | "autotile" | "water" | "forest" | "cliff";
export const TERRAIN_MODES: readonly { readonly mode: TerrainMode; readonly label: string; readonly example: string }[] = [
  { mode: "floor", label: "바닥 채우기", example: "예: 결이 고운 나무 마루" },
  { mode: "autotile", label: "가장자리 자동 타일", example: "예: 흙 위로 번지는 풀밭" },
  { mode: "water", label: "물가·움직이는 물", example: "예: 잔물결 이는 얕은 연못" },
  { mode: "forest", label: "숲 덩어리", example: "예: 짙은 활엽수 숲" },
  { mode: "cliff", label: "절벽·단", example: "예: 이끼 낀 회색 바위 절벽" },
];

/**
 * tile-gen 부탁 글 — 지형 한 벌. 참고 칸(`x,y`, 타일셋 그림의 칸 좌표)이 비면 에이전트가 가장 비슷한 땅 칸을 고르게 한다.
 * 타일셋 그림 파일은 화면의 「지금 맵 칩셋 그림 받기」로 받은 파일 이름이다.
 */
export function tileGenRequest(mode: TerrainMode, brief: string, tilesetFile: string, ref: string): string {
  const what = brief.trim() || defaultTerrain(mode);
  const cell = /^\s*\d+\s*,\s*\d+\s*$/.test(ref) ? ref.replace(/\s+/g, "") : "";
  switch (getLocale()) {
    case "en": return `Use tile-gen to make one terrain set (--mode ${mode}) for my tileset ${tilesetFile}: "${what}". ${cell ? `Reference cell: ${cell}.` : "Pick the closest terrain cells of the tileset as references yourself."} Run tile-gen auto (draw and review), let me pick on the local page (tile-gen pick), then run tile-gen pack to make a pack folder I can import into the OPRN editor.`;
    case "ja": return `tile-gen で私のタイルセット ${tilesetFile} に合う地形を1セット(--mode ${mode})作って:「${what}」。${cell ? `参考マス: ${cell}。` : "参考マスはタイルセットの一番近い地面マスを選んで。"}tile-gen auto で描画とレビューまで進め、ローカルページ(tile-gen pick)で私が選んだら、tile-gen pack で OPRN エディターに取り込めるパックフォルダを作って。`;
    case "zh": return `用 tile-gen 按我的图块集 ${tilesetFile} 做一组地形(--mode ${mode}):「${what}」。${cell ? `参考格:${cell}。` : "参考格请自己从图块集中挑最接近的地面格。"}用 tile-gen auto 完成绘制和审查,我在本地页面(tile-gen pick)挑选后,用 tile-gen pack 打包成可导入 OPRN 编辑器的文件夹。`;
    default: return `tile-gen 으로 내 타일셋 ${tilesetFile} 에 맞는 지형을 한 벌(--mode ${mode}) 만들어 줘: 「${what}」. ${cell ? `참고 칸: ${cell}.` : "참고 칸은 타일셋에서 가장 비슷한 땅 칸을 네가 골라."} tile-gen auto 로 그리기와 검토까지 돌리고, 내가 로컬 페이지(tile-gen pick)에서 고르면 tile-gen pack 으로 OPRN 에디터에 가져올 묶음 폴더를 만들어 줘.`;
  }
}

function defaultTerrain(mode: TerrainMode): string {
  const ko: Record<TerrainMode, string> = { floor: "결이 고운 나무 마루", autotile: "흙 위로 번지는 풀밭", water: "잔물결 이는 얕은 연못", forest: "짙은 활엽수 숲", cliff: "이끼 낀 회색 바위 절벽" };
  const en: Record<TerrainMode, string> = { floor: "fine-grained wooden floor", autotile: "grass spreading over dirt", water: "a shallow rippling pond", forest: "a dense broadleaf forest", cliff: "a mossy grey rock cliff" };
  const ja: Record<TerrainMode, string> = { floor: "木目の細かい板の床", autotile: "土の上に広がる草地", water: "さざ波の立つ浅い池", forest: "深い広葉樹の森", cliff: "苔むした灰色の岩の崖" };
  const zh: Record<TerrainMode, string> = { floor: "纹理细腻的木地板", autotile: "在泥土上蔓延的草地", water: "泛起涟漪的浅池", forest: "茂密的阔叶林", cliff: "长满青苔的灰色岩崖" };
  switch (getLocale()) {
    case "en": return en[mode];
    case "ja": return ja[mode];
    case "zh": return zh[mode];
    default: return ko[mode];
  }
}

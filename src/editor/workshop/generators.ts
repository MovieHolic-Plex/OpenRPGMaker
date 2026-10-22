// src/editor/workshop/generators.ts
/**
 * 공방 첫 화면의 생성기 카드 넷(2026-10-21 사용자 결정: 하네스 목록을 빼고 char-gen·object-gen·tile-gen·item-gen 과 잇는다).
 * 화면 글은 쉬운 말만 — 모델 이름·내부 용어를 쓰지 않는다. 상태는 정직하게:
 * - object-gen: 편집기 안에서 사용자 자기 AI 계정으로 그린다(공방 실행기). object-gen 이 만든 묶음도 가져온다.
 * - char-gen: 파이썬 도구라 브라우저에서 못 돈다 → 사용자 컴퓨터의 AI 에이전트에게 부탁할 글을 만들어 주고, 결과 묶음을 가져온다.
 * - tile-gen: 지형 생성기(2026-10-21 다시 만듦) — 이음매 없는 바닥·자동 타일 가장자리(47칸)·물가·움직이는 물·숲(숲 바닥 + 편집기가 놓는 나무, tile-gen PR #4 composer)·절벽.
 *   물건·기물·건물은 object-gen 만 그린다 — tile-gen 을 물건 생성기로 소개하지 않는다. char-gen 처럼 부탁 글 + 묶음 가져오기.
 *   묶음은 `oprn-store-pack/1` tileset 하나 + autotileGroups(·animationStrips) — 가져오기가 그대로 보존한다.
 * - item-gen: 저장소가 없다(2026-10-21 조직·홈 확인) → 「준비 중」. 가짜로 채우지 않는다.
 * 견본 그림(sample)은 그 생성기가 실제로 만든 그림이다: object-gen 은 그 저장소 docs/images/hero.png 의 고른 기물,
 * char-gen 은 실제 결과물(2026-10-22 교체): 데모 캐릭터 상반신(정수 1/7 칸 평균) + char-gen 칩 셋(정수 2배)(Scarloxy People1 바탕, CC BY 4.0 — 출처는
 * public/assets/ATTRIBUTION.md 「Workshop character card sample」)을 버들항 마당 위에 세운 그림. 전에는 그 저장소의 더미 바탕 칩
 * (examples/bases/dummy_*, 윤곽·명암 없는 자리표시용)이라 사용자가 「사람이 어색하다」고 했다.
 * tile-gen 견본은 비워 둔다: 첫 풀밭 견본(2026-10-21)은 겨냥한 beodeul_city 의 땅·나무·길·물 칸이 EasyRPG 계열이라 그 화풍 흉내가 돼
 * tile-gen 쪽이 거둬들였다. jp_city·코드 도트 버들항 키트를 겨냥한 결과가 독립 검수를 통과하면 그때 싣는다.
 */
import { getLocale } from "@/i18n";
import { genKitPins } from "@/harnesses/_core/workshop/genKits";

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
  readonly sample?: {
    readonly src: string; readonly width: number; readonly height: number; readonly alt: string; readonly caption?: string;
    /** 화면 배율(정수, 기본 2). 이미 정수 배율로 짜 맞춘 그림(칩 2배 + 상반신 1/7 칸 평균)은 1. */
    readonly scale?: number;
    /** 무대 위에서 제자리 걸음하는 칩(가로 띠 frames 칸 × 칩마다 한 줄, 그림 좌표 = 무대 그림 픽셀). workshopArt.generatorStage 가 그린다. */
    readonly walkers?: { readonly src: string; readonly frame: readonly [number, number]; readonly frames: number; readonly at: readonly (readonly [number, number])[] };
    /** 가끔 반짝이는 자리(무대 그림 픽셀) — 「갓 만든 물건」 느낌 */
    readonly twinkles?: readonly (readonly [number, number])[];
  };
}

export const WORKSHOP_GENERATORS: readonly WorkshopGenerator[] = [
  {
    id: "object-gen", title: "물건·가구", status: "ready",
    makes: "가구·상자·표지판 같은 물건을 지금 맵의 그림 느낌에 맞춰 그려요.",
    // 무대: object-gen 견본 기물 셋(object-gen-sample.png 에서 뒷판을 뗌)을 손 도트 실내 v5 칩셋의 판자벽·마루 위에(2026-10-22).
    sample: { src: "/assets/workshop/object-gen-stage.png", width: 124, height: 62, alt: "물건 생성기가 그린 진열장·냉장고·보관함", twinkles: [[12, 13], [76, 20], [112, 15]] },
  },
  {
    id: "char-gen", title: "캐릭터", status: "local",
    makes: "걷는 캐릭터의 옷·머리·색을 바꿔 새 사람을 만들어요.",
    // 무대: char-gen-sample.png 에서 칩을 뺀 판(char-gen-stage.png) + 같은 자리에서 제자리 걸음하는 칩 셋(char-gen-walk.png, 2배·4칸 1·0·1·2).
    sample: {
      src: "/assets/workshop/char-gen-stage.png", width: 248, height: 116, scale: 1, alt: "캐릭터 생성기가 만든 상반신 초상과 걷는 캐릭터 셋",
      walkers: { src: "/assets/workshop/char-gen-walk.png", frame: [48, 64], frames: 4, at: [[114, 40], [154, 40], [194, 40]] },
    },
  },
  { id: "tile-gen", title: "지형·바닥", status: "local", makes: "이음매 없는 바닥, 물가·절벽 가장자리, 칠해 넣는 숲과 물을 내 타일셋 색으로 그려요." },
  { id: "item-gen", title: "아이템 아이콘", status: "soon", makes: "물약·열쇠·무기 같은 아이템 아이콘을 그려 줄 거예요." },
];

export const GENERATOR_STATUS_LABELS: Readonly<Record<GeneratorStatus, string>> = {
  ready: "여기서 바로",
  local: "내 컴퓨터에서",
  next: "곧 나와요",
  soon: "준비 중",
};

/* 저장소 공개 여부(2026-10-21): object-gen 공개 · char-gen·tile-gen 비공개 — 정본은 tiledata/gen-kits.lock.json 의 visibility.
   비공개 저장소의 설치 링크는 화면에 내지 않는다(받은 사람 말고는 404). */

/**
 * 부탁 글 끝에 붙는 「이 편집기가 따르는 생성기 판」 한 줄(2026-10-22). 비공개 생성기(char-gen·tile-gen)는 지시문·판정 기준이
 * 사용자 컴퓨터의 그 저장소 안에서 돈다 — 글을 공개 모노레포로 옮기지 않으므로, lock(tiledata/gen-kits.lock.json)의 커밋을 적어
 * 사용자 에이전트가 같은 판으로 맞추게 한다. lock 을 올리면 다음 빌드부터 이 줄이 바뀌어 저장소 갱신이 사용자 쪽에도 닿는다.
 */
export function generatorPinLine(kit: "char-gen" | "tile-gen"): string {
  const commit = genKitPins[kit]?.commit;
  if (!commit) return "";
  const short = commit.slice(0, 7);
  switch (getLocale()) {
    case "en": return ` Use ${kit} at commit ${short} — the version this editor is checked against (in your ${kit} folder: git fetch && git checkout ${short}).`;
    case "ja": return ` ${kit} はコミット ${short} の版で使って(このエディターが合わせている版。${kit} フォルダで git fetch && git checkout ${short})。`;
    case "zh": return ` ${kit} 请用提交 ${short} 的版本(本编辑器对齐的版本:在 ${kit} 文件夹里 git fetch && git checkout ${short})。`;
    default: return ` ${kit} 는 커밋 ${short} 판으로 써 줘(이 편집기가 맞춰 둔 판 — ${kit} 폴더에서 git fetch && git checkout ${short}).`;
  }
}

/**
 * 사용자 컴퓨터의 AI 에이전트(자기 로그인)에게 붙여 넣을 부탁 글. 에이전트에게 가는 글이라 화면 번역 대상이 아니므로
 * 지금 언어로 직접 만든다. char-gen 스킬이 깔려 있으면 에이전트가 단계(만들기·검사·사람 고르기·묶기)를 알아서 한다.
 */
export function charGenRequest(what: string, count: number): string {
  return charGenText(what, count) + generatorPinLine("char-gen");
}

/** 부탁 글 본문(판 고정 줄 없이) — 화면 글칸에 보이는 부분. 복사할 때 generatorPinLine 이 붙는다. */
export function charGenText(what: string, count: number): string {
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
  { mode: "forest", label: "숲 바닥 + 나무", example: "예: 짙은 활엽수 숲 · 나무는 편집기가 놓아요" },
  { mode: "cliff", label: "절벽·단", example: "예: 이끼 낀 회색 바위 절벽" },
];

/**
 * tile-gen 프리셋 — 종류(kind) 하나에 그 재질의 그리기 지시가 붙은 것. CLI 는 `--mode <프리셋>` 을 그대로 받는다(tile-gen PR #3).
 * 묶음 모양은 그 종류와 같다(물 계열은 움직이는 물 = animationStrips).
 */
export type TerrainPreset = "lava" | "swamp" | "poison" | "deep_water" | "beach" | "snow" | "ice" | "sand" | "road" | "cobble" | "meadow";
export const TERRAIN_PRESETS: readonly { readonly mode: TerrainPreset; readonly kind: TerrainMode; readonly label: string; readonly example: string }[] = [
  { mode: "lava", kind: "water", label: "용암", example: "예: 식은 껍질 테두리가 빛나는 용암" },
  { mode: "swamp", kind: "water", label: "늪", example: "예: 진흙 위 탁한 늪물" },
  { mode: "poison", kind: "water", label: "독 웅덩이", example: "예: 얼룩진 땅 위 독 웅덩이" },
  { mode: "deep_water", kind: "water", label: "깊은 물", example: "예: 얕은 물 가운데의 깊은 물" },
  { mode: "beach", kind: "water", label: "바닷가", example: "예: 젖은 모래와 물거품이 이는 바닷물" },
  { mode: "snow", kind: "autotile", label: "눈 덮인 땅", example: "예: 풀밭 위에 쌓인 눈" },
  { mode: "ice", kind: "autotile", label: "얼음판", example: "예: 눈밭 위 얼음판" },
  { mode: "sand", kind: "autotile", label: "사막 모래", example: "예: 바람 물결이 진 사막 모래" },
  { mode: "road", kind: "autotile", label: "흙길", example: "예: 수레바퀴 자국 난 다져진 흙길" },
  { mode: "cobble", kind: "autotile", label: "돌길", example: "예: 경계석을 두른 돌 포장길" },
  { mode: "meadow", kind: "autotile", label: "꽃밭", example: "예: 풀밭으로 옅어지는 꽃밭" },
];

/**
 * tile-gen 부탁 글 — 지형 한 벌. 참고 칸(`x,y`, 타일셋 그림의 칸 좌표)이 비면 에이전트가 가장 비슷한 땅 칸을 고르게 한다.
 * 타일셋 그림 파일은 화면의 「지금 맵 칩셋 그림 받기」로 받은 파일 이름이다.
 */
export function tileGenRequest(mode: TerrainMode | TerrainPreset, brief: string, tilesetFile: string, ref: string): string {
  return tileGenText(mode, brief, tilesetFile, ref) + generatorPinLine("tile-gen");
}

export function tileGenText(mode: TerrainMode | TerrainPreset, brief: string, tilesetFile: string, ref: string): string {
  const what = brief.trim() || defaultTerrain(mode);
  const cell = /^\s*\d+\s*,\s*\d+\s*$/.test(ref) ? ref.replace(/\s+/g, "") : "";
  switch (getLocale()) {
    case "en": return `Use tile-gen to make one terrain set (--mode ${mode}) for my tileset ${tilesetFile}: "${what}". ${cell ? `Reference cell: ${cell}.` : "Pick the closest terrain cells of the tileset as references yourself."} Run tile-gen auto (draw and review), let me pick on the local page (tile-gen pick), then run tile-gen pack to make a pack folder I can import into the OPRN editor.`;
    case "ja": return `tile-gen で私のタイルセット ${tilesetFile} に合う地形を1セット(--mode ${mode})作って:「${what}」。${cell ? `参考マス: ${cell}。` : "参考マスはタイルセットの一番近い地面マスを選んで。"}tile-gen auto で描画とレビューまで進め、ローカルページ(tile-gen pick)で私が選んだら、tile-gen pack で OPRN エディターに取り込めるパックフォルダを作って。`;
    case "zh": return `用 tile-gen 按我的图块集 ${tilesetFile} 做一组地形(--mode ${mode}):「${what}」。${cell ? `参考格:${cell}。` : "参考格请自己从图块集中挑最接近的地面格。"}用 tile-gen auto 完成绘制和审查,我在本地页面(tile-gen pick)挑选后,用 tile-gen pack 打包成可导入 OPRN 编辑器的文件夹。`;
    default: return `tile-gen 으로 내 타일셋 ${tilesetFile} 에 맞는 지형을 한 벌(--mode ${mode}) 만들어 줘: 「${what}」. ${cell ? `참고 칸: ${cell}.` : "참고 칸은 타일셋에서 가장 비슷한 땅 칸을 네가 골라."} tile-gen auto 로 그리기와 검토까지 돌리고, 내가 로컬 페이지(tile-gen pick)에서 고르면 tile-gen pack 으로 OPRN 에디터에 가져올 묶음 폴더를 만들어 줘.`;
  }
}

const PRESET_DEFAULTS: Readonly<Record<TerrainPreset, readonly [string, string, string, string]>> = {
  lava: ["식은 껍질 테두리가 빛나는 용암", "molten lava with a glowing cooled-crust rim", "冷えた殻の縁が光る溶岩", "边缘冷却结壳、发着光的熔岩"],
  swamp: ["진흙 위 탁한 늪물", "murky swamp water over mud", "泥の上の濁った沼の水", "泥地上浑浊的沼泽水"],
  poison: ["얼룩진 땅 위 독 웅덩이", "a toxic pool over stained ground", "染みた地面の上の毒の水たまり", "污渍地面上的毒水坑"],
  deep_water: ["얕은 물 가운데의 깊은 물", "deep water inside shallow water", "浅瀬の中の深い水", "浅水中的深水"],
  beach: ["젖은 모래와 물거품이 이는 바닷물", "sea water with wet sand and foam", "濡れた砂と泡の立つ海水", "带湿沙与泡沫的海水"],
  snow: ["풀밭 위에 쌓인 눈", "snow cover over grass", "草地に積もった雪", "覆盖在草地上的雪"],
  ice: ["눈밭 위 얼음판", "an ice sheet over snow", "雪原の上の氷", "雪地上的冰面"],
  sand: ["바람 물결이 진 사막 모래", "desert sand with wind ripples", "風紋のある砂漠の砂", "带风纹的沙漠沙地"],
  road: ["수레바퀴 자국 난 다져진 흙길", "a packed dirt road with cart ruts", "轍のある踏み固めた土の道", "有车辙的夯实土路"],
  cobble: ["경계석을 두른 돌 포장길", "cobblestone paving with kerb stones", "縁石のある石畳", "带路缘石的鹅卵石路"],
  meadow: ["풀밭으로 옅어지는 꽃밭", "flowers thinning out into plain grass", "草地へ薄れていく花畑", "渐渐淡入草地的花田"],
};

function defaultTerrain(mode: TerrainMode | TerrainPreset): string {
  if (mode in PRESET_DEFAULTS) {
    const [ko, en, ja, zh] = PRESET_DEFAULTS[mode as TerrainPreset];
    switch (getLocale()) { case "en": return en; case "ja": return ja; case "zh": return zh; default: return ko; }
  }
  const ko: Record<TerrainMode, string> = { floor: "결이 고운 나무 마루", autotile: "흙 위로 번지는 풀밭", water: "잔물결 이는 얕은 연못", forest: "짙은 활엽수 숲", cliff: "이끼 낀 회색 바위 절벽" };
  const en: Record<TerrainMode, string> = { floor: "fine-grained wooden floor", autotile: "grass spreading over dirt", water: "a shallow rippling pond", forest: "a dense broadleaf forest", cliff: "a mossy grey rock cliff" };
  const ja: Record<TerrainMode, string> = { floor: "木目の細かい板の床", autotile: "土の上に広がる草地", water: "さざ波の立つ浅い池", forest: "深い広葉樹の森", cliff: "苔むした灰色の岩の崖" };
  const zh: Record<TerrainMode, string> = { floor: "纹理细腻的木地板", autotile: "在泥土上蔓延的草地", water: "泛起涟漪的浅池", forest: "茂密的阔叶林", cliff: "长满青苔的灰色岩崖" };
  const kind = mode as TerrainMode;
  switch (getLocale()) {
    case "en": return en[kind];
    case "ja": return ja[kind];
    case "zh": return zh[kind];
    default: return ko[kind];
  }
}

// 영역 작업 추천 명령 — 코퍼스(2026-07-10 corpus.md)에서 "가능" 판정 + 범용
// (특정 타일셋/기존 지물 의존 없음)만 선별한 12개. 모달이 열릴 때마다 4개씩 로테이션.
import type { SvgIconName } from "@/editor/panels/tileToolbarIcons";

export type TilesetCategory = "outdoor" | "dungeon" | "interior";

/**
 * 「다듬기」 기본 지시문 — 모달 버튼·캔버스 칩·추천 칩이 모두 이 한 문장을 쓴다.
 * 이 파일에 두는 이유는 import 순환 회피다: regionPolish → regionSurroundings →
 * regionContextSuggestions → suggestedCommands 사슬이 이미 있어서, 이 상수가 regionPolish 에
 * 있으면 추천 칩 목록이 그 사슬을 거꾸로 타야 한다.
 */
export const POLISH_INSTRUCTION = "이 영역을 주변과 자연스럽게 어울리도록 다듬어줘";

export interface SuggestedRegionCommand {
  readonly id: string;
  readonly icon: SvgIconName;
  readonly label: string;
  readonly instruction: string;
  readonly category: string;
  /** 이 명령이 적합한 타일셋 카테고리. 생략 또는 빈 배열 = 모든 타일셋(any).
   *  outdoor=combined_town/legacy, dungeon=easyrpg_chipset_dungeon, interior=easyrpg_chipset_interior.
   *  suggestRegionCommandsByContext 가 현재 타일셋 카테고리에 맞지 않는 명령을 필터링한다. */
  readonly tilesets?: readonly TilesetCategory[];
}

export const SUGGESTED_REGION_COMMANDS: readonly SuggestedRegionCommand[] = [
  { id: "round-pond", icon: "terrain", label: "둥근 호수", instruction: "여기에 둥근 호수를 만들어줘", category: "타일", tilesets: ["outdoor"] },
  { id: "small-cottage", icon: "structure", label: "오두막", instruction: "이 영역에 작은 오두막 한 채 지어줘", category: "구조물", tilesets: ["outdoor"] },
  { id: "flower-scatter", icon: "polish", label: "꽃밭", instruction: "여기 잔디밭에 꽃이랑 잡초를 자연스럽게 흩뿌려줘", category: "다듬기", tilesets: ["outdoor"] },
  { id: "treasure-chest", icon: "chest", label: "보물상자", instruction: "이 방에 보물상자를 하나 숨겨줘", category: "상호작용" },
  { id: "storage-chest", icon: "chest", label: "보관 상자", instruction: "여기에 아이템을 넣고 뺄 수 있는 보관 상자를 배치해줘", category: "상호작용" },
  { id: "merchant-npc", icon: "shop", label: "상인", instruction: "이 자리에 잡화점 상인 NPC 하나 배치해줘", category: "NPC" },
  { id: "pasture-fence", icon: "structure", label: "목장 울타리", instruction: "이 구역에 울타리를 둘러서 목장을 만들어줘", category: "구조물", tilesets: ["outdoor"] },
  { id: "garden", icon: "polish", label: "정원", instruction: "이 영역에 화단과 나무로 정원을 조성해줘", category: "구조물", tilesets: ["outdoor"] },
  { id: "gate-guards", icon: "npc", label: "경비병", instruction: "여기 입구 앞에 경비병 두 명 세워줘", category: "NPC" },
  { id: "inn-guests", icon: "structure", label: "여관", instruction: "이 공터에 여관을 짓고 손님 NPC 몇 명과 주인을 배치해줘", category: "복합", tilesets: ["outdoor"] },
  { id: "festival", icon: "composite", label: "축제 분위기", instruction: "이 광장에 축제 분위기 내게 등불이랑 좌판, 상인들 배치해줘", category: "복합", tilesets: ["outdoor"] },
  { id: "dark-mood", icon: "mood", label: "음산한 조명", instruction: "이 방을 어둡고 음산한 조명으로 바꿔줘", category: "분위기" },
  { id: "encounter-zone", icon: "combat", label: "몬스터 구역", instruction: "이 영역에 들어서면 슬라임이 나오는 인카운터 구역으로 설정해줘", category: "전투" },
  // 아래 3개는 카테고리를 골랐을 때 칩이 한 개만 남던 빈칸(타일·다듬기·분위기)을 메운다.
  // 지시문은 이미 다른 경로에서 쓰이는 표현을 그대로 쓴다(입력창 placeholder 의 "침엽수 숲" 등).
  { id: "conifer-forest", icon: "terrain", label: "침엽수 숲", instruction: "이 영역을 침엽수 숲으로 채워줘", category: "타일", tilesets: ["outdoor"] },
  { id: "dirt-path", icon: "terrain", label: "흙길", instruction: "이 영역을 가로지르는 흙길을 깔아줘", category: "타일", tilesets: ["outdoor"] },
  { id: "scatter-rocks", icon: "polish", label: "바위 흩뿌리기", instruction: "이 영역에 바위와 돌무더기를 자연스럽게 흩뿌려줘", category: "다듬기" },
  { id: "lantern-mood", icon: "mood", label: "등불 분위기", instruction: "이 공간에 등불을 걸어 따뜻하고 밝은 분위기로 만들어줘", category: "분위기" },
  // 주변 어울림 재구성. 타일셋을 가리지 않는다(실내·던전도 주변과 이어져야 한다).
  // 목록 **끝에** 붙인 이유: 앞에 넣으면 로테이션(nextSuggestedRegionCommands) 순번이 통째로
  // 밀려 기존 진입점의 첫 화면 추천이 다 바뀐다.
  { id: "blend-surroundings", icon: "polish", label: "주변과 어울리게", instruction: POLISH_INSTRUCTION, category: "다듬기" },
] as const;

/**
 * 주변 타일을 보고만 뜨는 문맥 추천 명령. 예전에는 regionContextSuggestions 안의 리터럴이라
 * **카테고리 칩으로는 영영 볼 수 없었다** — 같은 카테고리를 골라도 목록에 없었다.
 * 카테고리 묶음(regionCommandCategories)과 문맥 추천이 같은 원본을 보게 하려고 여기로 옮겼다.
 */
export const CONTEXT_REGION_COMMANDS: readonly SuggestedRegionCommand[] = [
  { id: "dock", icon: "structure", label: "부두", instruction: "물 옆에 나무 부두를 만들어줘", category: "구조물", tilesets: ["outdoor"] },
  { id: "bridge", icon: "structure", label: "다리", instruction: "이 영역에 다리를 놓아줘", category: "구조물", tilesets: ["outdoor"] },
  { id: "street-trees", icon: "polish", label: "가로수", instruction: "길을 따라 가로수를 심어줘", category: "다듬기", tilesets: ["outdoor"] },
  { id: "hunting-ground", icon: "combat", label: "사냥터", instruction: "이 영역을 슬라임이 나오는 사냥터로 만들어줘", category: "전투", tilesets: ["outdoor"] },
  { id: "campfire", icon: "mood", label: "캠프파이어", instruction: "숲 가장자리에 캠프파이어와 통나무 의자를 만들어줘", category: "구조물", tilesets: ["outdoor"] },
] as const;

/** 카테고리 칩이 보여 줄 전체 명령 — 정적 코퍼스 + 문맥 전용 명령. */
export const ALL_REGION_COMMANDS: readonly SuggestedRegionCommand[] = [
  ...SUGGESTED_REGION_COMMANDS,
  ...CONTEXT_REGION_COMMANDS,
] as const;

export interface RegionCommandCategory {
  readonly id: string;
  readonly label: string;
  readonly icon: SvgIconName;
  readonly commands: readonly SuggestedRegionCommand[];
}

// 카테고리 표시 순서·아이콘·ASCII id. 왜 고정 목록인가: 로테이션 4개만 보이면 "지형 도구"로만
// 읽혀서, 실제로 가능한 범위(NPC·전투·분위기)가 사용자에게 전달되지 않았다. 순서는 "지형 →
// 사물 → 사람 → 그 외"로 사용자가 찾는 빈도순이다.
// id 를 ASCII 로 따로 두는 이유: 이 값이 data-testid(`region-category-<id>`)와 CSS 선택자에
// 들어간다 — 한글이 그대로 들어가면 셀렉터 이스케이프가 필요해진다.
const CATEGORY_ORDER: readonly { readonly id: string; readonly label: string; readonly icon: SvgIconName }[] = [
  { id: "tiles", label: "타일", icon: "terrain" },
  { id: "structures", label: "구조물", icon: "structure" },
  { id: "polish", label: "다듬기", icon: "polish" },
  { id: "npc", label: "NPC", icon: "npc" },
  { id: "interaction", label: "상호작용", icon: "chest" },
  { id: "combat", label: "전투", icon: "combat" },
  { id: "mood", label: "분위기", icon: "mood" },
  { id: "composite", label: "복합", icon: "composite" },
];

/**
 * SUGGESTED_REGION_COMMANDS 를 category 로 묶어 표시 순서대로 돌려준다.
 * 명령이 없는 카테고리는 빈 칩이 되므로 생략한다.
 * CATEGORY_ORDER 에 없는 category 문자열도 pin 아이콘으로 뒤에 붙여 반환한다 — 명령을 추가하면서
 * 이 목록을 잊었을 때 그 칩이 조용히 사라지면 추가 사실 자체를 눈치챌 수 없다.
 */
export function regionCommandCategories(): RegionCommandCategory[] {
  const byCategory = new Map<string, SuggestedRegionCommand[]>();
  for (const command of ALL_REGION_COMMANDS) {
    const bucket = byCategory.get(command.category);
    if (bucket) bucket.push(command);
    else byCategory.set(command.category, [command]);
  }
  const result: RegionCommandCategory[] = [];
  for (const entry of CATEGORY_ORDER) {
    const commands = byCategory.get(entry.label);
    if (!commands || commands.length === 0) continue;
    byCategory.delete(entry.label);
    result.push({ id: entry.id, label: entry.label, icon: entry.icon, commands });
  }
  // 남은 것 = 아직 CATEGORY_ORDER 에 등록되지 않은 새 카테고리.
  for (const [label, commands] of byCategory) {
    if (commands.length === 0) continue;
    result.push({ id: label, label, icon: "pin", commands });
  }
  return result;
}

let rotation = 0;
// 시작 화면 카드("이렇게 해보세요")는 모달과 별도의 로테이션 순번을 쓴다 — 두 진입점이 같은 카운터를
// 공유하면 "새 대화"를 누를 때마다 모달 쪽 로테이션이 예측 불가하게 어긋난다.
let startScreenRotation = 0;

function rotate(counter: number, count: number): { readonly picked: SuggestedRegionCommand[]; readonly next: number } {
  const total = SUGGESTED_REGION_COMMANDS.length;
  const start = counter % total;
  const next = (counter + count) % total;
  const picked = Array.from({ length: Math.min(count, total) }, (_, index) => SUGGESTED_REGION_COMMANDS[(start + index) % total]);
  return { picked, next };
}

/** 모달이 열릴 때 4개(기본)를 순서대로 로테이션해 돌려준다. */
export function nextSuggestedRegionCommands(count = 4): SuggestedRegionCommand[] {
  const { picked, next } = rotate(rotation, count);
  rotation = next;
  return picked;
}

/** 기본 모드 시작 화면 카드가 3개(기본)를 순서대로 로테이션해 돌려준다 — 모달과 독립된 카운터. */
export function nextStartScreenSuggestedCommands(count = 3): SuggestedRegionCommand[] {
  const { picked, next } = rotate(startScreenRotation, count);
  startScreenRotation = next;
  return picked;
}

export function __resetSuggestedRegionRotationForTest(): void {
  rotation = 0;
}

export function __resetStartScreenSuggestedRotationForTest(): void {
  startScreenRotation = 0;
}

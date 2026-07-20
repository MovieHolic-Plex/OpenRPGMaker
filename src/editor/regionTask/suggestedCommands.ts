// 영역 작업 추천 명령 — 코퍼스(2026-07-10 corpus.md)에서 "가능" 판정 + 범용
// (특정 타일셋/기존 지물 의존 없음)만 선별한 12개. 모달이 열릴 때마다 4개씩 로테이션.
export type TilesetCategory = "outdoor" | "dungeon" | "interior";

export interface SuggestedRegionCommand {
  readonly id: string;
  readonly label: string;
  readonly instruction: string;
  readonly category: string;
  /** 이 명령이 적합한 타일셋 카테고리. 생략 또는 빈 배열 = 모든 타일셋(any).
   *  outdoor=combined_town/legacy, dungeon=easyrpg_chipset_dungeon, interior=easyrpg_chipset_interior.
   *  suggestRegionCommandsByContext 가 현재 타일셋 카테고리에 맞지 않는 명령을 필터링한다. */
  readonly tilesets?: readonly TilesetCategory[];
}

export const SUGGESTED_REGION_COMMANDS: readonly SuggestedRegionCommand[] = [
  { id: "round-pond", label: "🌊 둥근 호수", instruction: "여기에 둥근 호수를 만들어줘", category: "타일", tilesets: ["outdoor"] },
  { id: "small-cottage", label: "🏠 오두막", instruction: "이 영역에 작은 오두막 한 채 지어줘", category: "구조물", tilesets: ["outdoor"] },
  { id: "flower-scatter", label: "🌸 꽃밭", instruction: "여기 잔디밭에 꽃이랑 잡초를 자연스럽게 흩뿌려줘", category: "다듬기", tilesets: ["outdoor"] },
  { id: "treasure-chest", label: "🎁 보물상자", instruction: "이 방에 보물상자를 하나 숨겨줘", category: "상호작용" },
  { id: "storage-chest", label: "📦 보관 상자", instruction: "여기에 아이템을 넣고 뺄 수 있는 보관 상자를 배치해줘", category: "상호작용" },
  { id: "merchant-npc", label: "🧑‍🌾 상인", instruction: "이 자리에 잡화점 상인 NPC 하나 배치해줘", category: "NPC" },
  { id: "pasture-fence", label: "🐄 목장 울타리", instruction: "이 구역에 울타리를 둘러서 목장을 만들어줘", category: "구조물", tilesets: ["outdoor"] },
  { id: "garden", label: "🌳 정원", instruction: "이 영역에 화단과 나무로 정원을 조성해줘", category: "구조물", tilesets: ["outdoor"] },
  { id: "gate-guards", label: "💂 경비병", instruction: "여기 입구 앞에 경비병 두 명 세워줘", category: "NPC" },
  { id: "inn-guests", label: "🛏️ 여관", instruction: "이 공터에 여관을 짓고 손님 NPC 몇 명과 주인을 배치해줘", category: "복합", tilesets: ["outdoor"] },
  { id: "festival", label: "🏮 축제 분위기", instruction: "이 광장에 축제 분위기 내게 등불이랑 좌판, 상인들 배치해줘", category: "복합", tilesets: ["outdoor"] },
  { id: "dark-mood", label: "🌑 음산한 조명", instruction: "이 방을 어둡고 음산한 조명으로 바꿔줘", category: "분위기" },
  { id: "encounter-zone", label: "⚔️ 몬스터 구역", instruction: "이 영역에 들어서면 슬라임이 나오는 인카운터 구역으로 설정해줘", category: "전투" },
] as const;

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

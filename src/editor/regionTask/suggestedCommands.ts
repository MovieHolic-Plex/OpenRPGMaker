// 영역 작업 추천 명령 — 코퍼스(2026-07-10 corpus.md)에서 "가능" 판정 + 범용
// (특정 타일셋/기존 지물 의존 없음)만 선별한 12개. 모달이 열릴 때마다 4개씩 로테이션.
export interface SuggestedRegionCommand {
  readonly id: string;
  readonly label: string;
  readonly instruction: string;
  readonly category: string;
}

export const SUGGESTED_REGION_COMMANDS: readonly SuggestedRegionCommand[] = [
  { id: "round-pond", label: "🌊 둥근 호수", instruction: "여기에 둥근 호수를 만들어줘", category: "타일" },
  { id: "small-cottage", label: "🏠 오두막", instruction: "이 영역에 작은 오두막 한 채 지어줘", category: "구조물" },
  { id: "flower-scatter", label: "🌸 꽃밭", instruction: "여기 잔디밭에 꽃이랑 잡초를 자연스럽게 흩뿌려줘", category: "다듬기" },
  { id: "treasure-chest", label: "🎁 보물상자", instruction: "이 방에 보물상자를 하나 숨겨줘", category: "상호작용" },
  { id: "merchant-npc", label: "🧑‍🌾 상인", instruction: "이 자리에 잡화점 상인 NPC 하나 배치해줘", category: "NPC" },
  { id: "pasture-fence", label: "🐄 목장 울타리", instruction: "이 구역에 울타리를 둘러서 목장을 만들어줘", category: "구조물" },
  { id: "garden", label: "🌳 정원", instruction: "이 영역에 화단과 나무로 정원을 조성해줘", category: "구조물" },
  { id: "gate-guards", label: "💂 경비병", instruction: "여기 입구 앞에 경비병 두 명 세워줘", category: "NPC" },
  { id: "inn-guests", label: "🛏️ 여관", instruction: "이 공터에 여관을 짓고 손님 NPC 몇 명과 주인을 배치해줘", category: "복합" },
  { id: "festival", label: "🏮 축제 분위기", instruction: "이 광장에 축제 분위기 내게 등불이랑 좌판, 상인들 배치해줘", category: "복합" },
  { id: "dark-mood", label: "🌑 음산한 조명", instruction: "이 방을 어둡고 음산한 조명으로 바꿔줘", category: "분위기" },
  { id: "encounter-zone", label: "⚔️ 몬스터 구역", instruction: "이 영역에 들어서면 슬라임이 나오는 인카운터 구역으로 설정해줘", category: "전투" },
] as const;

let rotation = 0;

/** 모달이 열릴 때 4개(기본)를 순서대로 로테이션해 돌려준다. */
export function nextSuggestedRegionCommands(count = 4): SuggestedRegionCommand[] {
  const total = SUGGESTED_REGION_COMMANDS.length;
  const start = rotation % total;
  rotation = (rotation + count) % total;
  return Array.from({ length: Math.min(count, total) }, (_, index) => SUGGESTED_REGION_COMMANDS[(start + index) % total]);
}

export function __resetSuggestedRegionRotationForTest(): void {
  rotation = 0;
}

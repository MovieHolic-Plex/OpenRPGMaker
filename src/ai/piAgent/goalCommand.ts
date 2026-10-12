// /goal is the explicit long-running campaign entry point.
// It is intentionally a command contract, rather than a natural-language guess:
// the caller is asking the assistant to keep working until a playable world exists.

export const GOAL_COMMAND_PREFIX = "/goal";
export const GOAL_MIN_MAPS = 10;
export const GOAL_MAX_TURNS = 600;
export const GOAL_TIMEOUT_MS = 45 * 60_000;
export const GOAL_CAMPAIGN_MARKER = "[OPRN_GOAL_CAMPAIGN]";

const GOAL_COMMAND_PATTERN = /^\/goal(?=\s|$)/iu;

export function goalCommandBody(text: string): string | null {
  const trimmed = text.trim();
  const prefix = GOAL_COMMAND_PATTERN.exec(trimmed);
  return prefix ? trimmed.slice(prefix[0].length).trim() : null;
}

export function isGoalCommand(text: string): boolean {
  return goalCommandBody(text) !== null;
}

/** A genre-neutral scaffold that forces visual and gameplay variety without prescribing one art style. */
export const GOAL_CAMPAIGN_MAP_BLUEPRINT = [
  "1. 시작 거점: 주인공의 출발점, 안내 NPC, 첫 선택과 보상",
  "2. 외곽 경로: 거점에서 다음 지역으로 이어지는 탐험 루트와 첫 발견이나 조우",
  "3. 자연 지형: 숲·습지·사막·설원 등 거점과 다른 지형, 수집 또는 생존 상호작용",
  "4. 랜드마크: 탑·폐허·신전·항구·성문 등 멀리서 식별되는 목적지와 작은 퍼즐",
  "5. 실내 시설: 상점·여관·연구소·공방 등 기능이 분명한 내부 공간",
  "6. 위험 지역: 동굴·폐광·하수도·요새 등 장르에 맞는 위험·퍼즐과 분기 경로",
  "7. 사회 공간: 시장·축제·수용소·문파 등 NPC 관계와 퀘스트가 발생하는 장소",
  "8. 이동 지형: 강·해안·산길·협곡·철도 등 이동 방식이 달라지는 맵",
  "9. 비밀/보너스 구역: 조건부 입구, 숨은 보물, 선택적 도전",
  "10. 결전/결말 지역: 핵심 사건 또는 장르가 요구하는 보스, 이전 선택의 결과와 다음 플레이 안내",
].join("\n");

export const GOAL_CAMPAIGN_CONTRACT = [
  GOAL_CAMPAIGN_MARKER,
  "이것은 짧은 데모가 아니라 장기 목표 제작 런이다. 사용자가 별도로 줄인 범위가 없으면 끝까지 계속한다.",
  `하드 완료 조건: 프로젝트 전체 맵이 최소 ${GOAL_MIN_MAPS}개이고, 모든 맵에 실제 플레이 콘텐츠가 있으며, 시작 맵에서 실제 이동 이벤트로 이어져야 한다.`,
  "기획의 장르와 핵심 행동을 우선한다. 전투 없는 이야기에는 적·장비·보스전을 추가하지 말고 기억·조사·선택·관계의 결과로 장소를 구분한다. 아래 예시는 고정된 마을/판타지 템플릿이 아니다. 학교·실내·도시·농장 등 확정 무대 안에서 장소 이름과 형태를 새로 설계한다.",
  "첫 구간은 전체 캠페인의 도입부다. 추천 프리셋의 첫 제작 범위 문구만 보고 도입부에서 완료하지 않는다. 사용자가 명시한 제한과 기획 내용은 보존한다.",
  "아래 10개 역할은 참고다. 확정 기획의 무대와 핵심 행동으로 10개 이상의 장소를 설계하고, 맞지 않는 역할은 대체한다. 맵 수만 늘리려고 집·길·잔디를 복제하지 않는다.",
  GOAL_CAMPAIGN_MAP_BLUEPRINT,
  "각 맵은 서로 다른 역할과 장소를 가져야 하며, 빈 바닥·복제 맵·표지판만 있는 맵을 완료로 세지 않는다.",
  "각 맵에는 지형/경로, 최소 한 개의 눈에 보이는 랜드마크나 구조물, NPC·이벤트·보물·상점·인카운터 중 해당 장소에 맞는 실제 상호작용 콘텐츠를 넣는다. 관련 콘텐츠(이벤트, 연결, 시작 위치, 전투/퀘스트/보상)는 맵 시공과 별도 단계로 채운다.",
  "맵 2개나 한 마을에서 멈추지 않는다. 맵 수와 연결·콘텐츠를 직접 조회해 부족하면 즉시 다음 맵을 만들고, 마지막에 전체 맵 목록·연결·lint를 다시 확인한다.",
].join("\n");

export function isGoalCampaignTask(text: string): boolean {
  return text.includes(GOAL_CAMPAIGN_MARKER);
}

export function goalCampaignTask(brief: string): string {
  const body = brief.trim();
  return body ? `${GOAL_CAMPAIGN_CONTRACT}\n\n사용자 목표:\n${body}` : GOAL_CAMPAIGN_CONTRACT;
}


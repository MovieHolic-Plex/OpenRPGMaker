// 의도 라우팅 표: 25 양성 + 20 반례를 hasMonsterCollectIntent(= 키트·잠금 신호의 근거)와 classifyPlainPiTurn.monsterKit 으로 잰다. bun 으로 실행.
import { createBlankProject } from "../../../src/project/defaults.ts";
import { resolveAutonomy } from "../../../src/ai/autonomyLevels.ts";
import { classifyPlainPiTurn } from "../../../src/ai/piAgent/plainTurn.ts";
import { fallbackIntentDeclaration } from "../../../src/ai/intentDeclaration.ts";
import { hasMonsterCollectIntent } from "../../../src/ai/piAgent/monsterGameRequest.ts";

const positives = [
  "포켓몬 라이크 만들어 줘", "포켓몬 같은 게임 만들어줘", "RPG 몬스터 수집", "몬스터 수집 RPG 만들어줘", "몬스터를 잡아서 키우는 게임",
  "몬스터 수집 게임", "포켓몬 게임", "에메랄드풍 게임 만들어줘", "monster collecting game", "Make a pokemon-like game", "creature collector RPG please",
  "몬스터 도감 채우는 게임 만들어줘", "체육관 도는 게임", "트레이너가 돌아다니는 마을 만들어 줘", "몬스터 수집 마을 만들어 줘", "pocket monsters clone",
  "다마고치 같은 육성 게임", "몬스터와 함께 모험하는 RPG", "테이머 RPG 만들어줘", "수집형 RPG 만들어줘", "펫 키우기 게임", "디지몬 같은 게임",
  "장르 프리셋: 몬스터 수집",
  "괴물 키우고 배틀하는 게임", "야생 동물 잡아서 싸우는 RPG", "리그 우승 노리는 트레이너 이야기", "마을 사이를 오가며 동료를 모으는 게임",
];
const negatives = [
  "연애 시뮬레이션 RPG 만들어 줘", "일반 판타지 RPG 게임 만들어 줘", "몬스터 헌터 같은 RPG 만들어 줘", "로그라이크 RPG 만들어 줘", "좀비 서바이벌 RPG", "소울라이크 몬스터 헌터 게임",
  "헬스 트레이너가 나오는 연애 게임", "학교 체육관에서 만나는 연애 게임", "체육관 맵 만들어 줘", "카드 수집형 게임 만들어 줘", "아이템 수집형 던전 RPG", "던전에 몬스터 배치해 줘",
  "펫샵이 있는 마을 만들어 줘", "personal trainer romance game", "농장 동물 돌보는 게임", "보물 수집 퍼즐", "몬스터를 쓰러뜨리는 던전 RPG",
  "축구 리그 우승을 노리는 감독 시뮬레이션", "마을 사이를 오가는 상인 게임", "동료와 함께 던전을 도는 RPG",
  "괴물이 나오는 공포 게임", "야생 동물을 사냥해 요리하는 서바이벌",
];
const run = async (text: string) => {
  const project = createBlankProject();
  const r: any = await classifyPlainPiTurn({ project, text, currentMapId: project.startMapId, selection: null, hasActivePlan: false, autonomy: resolveAutonomy("autonomous"), declarer: () => (async (facts: any) => ({ intent: { ...fallbackIntentDeclaration(facts), source: "llm", mode: "create", needsPlan: false, clarify: null }, elapsedMs: 1 })) as any, piTeam: false });
  return r.monsterKit === true;
};
let tp = 0, fp = 0;
console.log("## 양성");
for (const t of positives) { const a = hasMonsterCollectIntent(t), b = await run(t); if (a && b) tp++; console.log(a ? "O" : "X", b ? "O" : "X", t); }
console.log("## 반례");
for (const t of negatives) { const a = hasMonsterCollectIntent(t), b = await run(t); if (a || b) fp++; console.log(a ? "FP" : "ok", b ? "FP" : "ok", t); }
console.log(`양성 ${tp}/${positives.length} · 반례 오탐 ${fp}/${negatives.length} (양성=두 판정 모두 O)`);

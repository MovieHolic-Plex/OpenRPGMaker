// jrpg-loop-1 ff1: 의도 메모(모험 지침 속 「몬스터」「포켓몬풍」「트레이너」)가 몬스터 신호로 읽혀 FF6풍 요청이 포켓몬형 캠페인으로 납치됐다.
import { describe, expect, it } from "vitest";
import { composePiTask } from "@/ai/piAgent/executionRoute";
import { classifyMonsterGameRequest, hasMonsterCollectIntent, requestsEmeraldMonsterGame } from "@/ai/piAgent/monsterGameRequest";
import { ADVENTURE_AUTHORING_GUIDE } from "@/ai/adventureCompletion";

const ASK = "파이널판타지6 같은 게임 만들어 줘. 세계가 한 번 무너지고, 흩어진 동료들을 다시 모으는 이야기로";
const NOTE = `${ADVENTURE_AUTHORING_GUIDE}\n[의도] 던전 층 시공이다. 장르(포켓몬풍 짧은 던전 / 일반 RPG 긴 던전)는 몬스터 키트 기준, 시선 트레이너·도감.`;

describe("의도 메모는 몬스터 의도 판정에 들어가지 않는다", () => {
  it("사용자 글만 보면 몬스터 요청이 아니다", () => {
    expect(hasMonsterCollectIntent(ASK)).toBe(false);
    expect(classifyMonsterGameRequest(ASK)).toBeNull();
  });
  it("메모가 붙은 모델 task 도 마찬가지다", () => {
    const task = composePiTask(ASK, NOTE);
    expect(hasMonsterCollectIntent(task)).toBe(false);
    expect(classifyMonsterGameRequest(task)).toBeNull();
    expect(requestsEmeraldMonsterGame(task)).toBe(false);
  });
  it("진짜 몬스터 요청은 메모가 붙어도 그대로 잡힌다", () => {
    const ask = "포켓몬 같은 몬스터 수집 게임 만들어 줘. 체육관을 돌며 도감을 채우는 이야기";
    expect(classifyMonsterGameRequest(composePiTask(ask, NOTE))).toBe("campaign");
  });
});

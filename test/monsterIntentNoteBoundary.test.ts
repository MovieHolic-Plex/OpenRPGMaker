// jrpg-loop-1 ff1: 의도 메모(모험 지침 속 「몬스터」「포켓몬풍」「트레이너」)가 몬스터 신호로 읽혀 FF6풍 요청이 포켓몬형 캠페인으로 납치됐다.
import { describe, expect, it } from "vitest";
import { composePiTask } from "@/ai/piAgent/executionRoute";
import { classifyMonsterGameRequest, hasMonsterCollectIntent, requestsEmeraldMonsterGame } from "@/ai/piAgent/monsterGameRequest";
import { ADVENTURE_AUTHORING_GUIDE } from "@/ai/adventureCompletion";

const ASK = "파이널판타지6 같은 게임 만들어 줘. 세계가 한 번 무너지고, 흩어진 동료들을 다시 모으는 이야기로";
const NOTE = `${ADVENTURE_AUTHORING_GUIDE}\n[의도] 던전 층 시공이다. 장르(포켓몬풍 짧은 던전 / 일반 RPG 긴 던전)는 몬스터 키트 기준, 시선 트레이너·도감.`;

describe("긴 요청(그림 도안 묘사)에서도 몬스터 의도 판정이 선형으로 끝난다", () => {
  // 2026-11-05 imageplan-describe: 앞보기 정규식에 ^ 가 없어 8~15천 자 묘사에서 수십 초, 브라우저는 「too much recursion」으로 턴이 죽었다.
  it("15천 자 묘사를 1초 안에 판정하고 마을 오가며 동료 모으기는 여전히 잡는다", () => {
    const long = "집 지어줘\n\n" + "거실 북쪽에 돌 벽난로, 붉은 러그 위 소파와 낮은 탁자. ".repeat(400);
    const t0 = performance.now();
    expect(hasMonsterCollectIntent(long)).toBe(false);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(hasMonsterCollectIntent("몬스터와 함께 동료를 모아 마을 사이를 오가는 게임")).toBe(true);
  });
});

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

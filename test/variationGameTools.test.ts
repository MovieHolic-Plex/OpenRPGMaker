// 변주 카드 구조 축이 이름 댄 도구는 v2 게임 도구 묶음에 들어야 한다 — 노출 고정만으로는 묶음 밖 도구가 세션에 없다
// (2026-11-26 variant-remeasure after5 r1: stage_map_reveal «이 세션에 없음»).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createGameTools } from "@/ai/v2/game";
import { gameVariation } from "@/ai/v2/request/world";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";

const HORROR = "밤의 미술관에 갇힌 아이가 단서를 모아 빠져나가는 공포 게임을 만들어 줘.";
const SEED = createBlankProject();

describe("createGameTools with a variation card", () => {
  it("carries the structure axis tool (stage_map_reveal) into the game tool set", () => {
    let key: string | undefined;
    for (let i = 0; i < 200 && !key; i++) {
      const candidate = JSON.stringify(["project", `gt-${i}`]);
      if (gameVariation(SEED, candidate, HORROR).variation?.structure?.tools?.includes("stage_map_reveal")) key = candidate;
    }
    expect(key).toBeDefined();
    const env = { ctx: { project: SEED }, request: { projectKey: key, task: HORROR }, record: () => {} } as unknown as PiAssistantV2Env;
    expect(createGameTools(env, HORROR).map((tool) => tool.name)).toContain("stage_map_reveal");
  });
});

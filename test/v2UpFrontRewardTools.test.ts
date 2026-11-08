// 2026-11-08 실험 1(terra-game-strategy B7): 보상·인물·퍼즐 도구를 게임 요청의 «처음» 도구에 올린다.
//
// 왜: terra-fun-game 부품 채점에서 reward 가 high 0.75 · medium 0.33 이었고, 상점·골드 명령은 판마다 0회였다.
// V2_UP_FRONT 의 기준이 «기록에서 terra 가 10세션 이상 부른 도구»였는데, 한 번도 쥐여 주지 않은 도구는 영원히
// 그 기록에 안 들어간다(순환). 그래서 upsert_item·place_npc(원래 게임 묶음)와 compile_puzzle(묶음에 없던 것)을
// 업프론트로 올린다. 이 테스트는 «게임 요청에서 처음부터 실리는가»와 «맵 전용 요청에서는 여전히 안 실리는가»를 고정한다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import { createV2Tools, V2Session } from "@/ai/v2/verbs";
import { exposeV2Tools } from "@/ai/v2/toolExposure";

const REWARD_TOOLS = ["upsert_item", "place_npc", "compile_puzzle"];

function exposureFor(task: string) {
  const project = createBlankProject();
  const env = {
    ctx: { project, currentMapId: project.startMapId, assistantRun: true },
    request: { task, provider: "openai-compat:opencodex", mapIds: [], project },
    emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {},
    lazyToolsVia: "tool",
  } as never;
  return exposeV2Tools(env, createV2Tools(env, new V2Session()));
}

describe("v2 up-front reward tools (experiment 1 · B7)", () => {
  it("a whole-game request carries the reward, cast and puzzle tools from the first call", () => {
    const exposure = exposureFor("재밌는 게임 만들어 줘.");
    const upFront = exposure.tools.map((tool) => tool.name);
    for (const name of REWARD_TOOLS) expect(upFront, name).toContain(name);
  });

  it("the puzzle compiler is part of the game tool bundle, so it can be offered at all", () => {
    const exposure = exposureFor("귀여운 고양이가 주인공인 탐험 게임 만들어줘");
    expect(exposure.lazy.has("compile_puzzle")).toBe(true);
    expect(exposure.tools.map((tool) => tool.name)).toContain("compile_puzzle");
  });

  it("a map-only tile request does not pay for the game tools", () => {
    const exposure = exposureFor("이 맵에 나무 몇 그루만 더 심어 줘");
    const upFront = exposure.tools.map((tool) => tool.name);
    for (const name of REWARD_TOOLS) expect(upFront, name).not.toContain(name);
  });
});

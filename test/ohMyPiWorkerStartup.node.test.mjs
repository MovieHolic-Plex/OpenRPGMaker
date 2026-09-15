import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createOhMyPiAdapters, stopOhMyPiWorker } from "../scripts/lib/ohMyPiPiAi.mjs";

// Break: 워커가 기동에서 죽으면(모듈 누락·잘못된 import) 종료 코드만 올라와 편집기에는
// "Pi 에이전트 실패" 로만 보인다. 실측(2026-09-10): @oh-my-pi/pi-agent-core 가 설치되지
// 않아 모든 Pi 실행이 실패했는데 원인은 서버 콘솔에만 남아 사용자가 알 방법이 없었다.
describe("oh-my-pi 워커 기동 실패", () => {
  it("기동에서 죽은 워커의 stderr 원인을 호출자 오류에 싣는다", async () => {
    const previous = process.env.OPRN_OH_MY_PI_WORKER_COMMAND;
    process.env.OPRN_OH_MY_PI_WORKER_COMMAND =
      `>&2 echo "error: Cannot find module '@oh-my-pi/pi-agent-core'"; exit 1`;
    try {
      const adapters = await createOhMyPiAdapters();
      await assert.rejects(
        adapters.runAgent("openai-codex", { task: "t", mapIds: [], project: {} }, {}),
        (error) => {
          assert.match(error.message, /exited \(1\)/);
          assert.match(error.message, /Cannot find module/);
          return true;
        },
      );
    } finally {
      stopOhMyPiWorker();
      if (previous === undefined) delete process.env.OPRN_OH_MY_PI_WORKER_COMMAND;
      else process.env.OPRN_OH_MY_PI_WORKER_COMMAND = previous;
    }
  });
});

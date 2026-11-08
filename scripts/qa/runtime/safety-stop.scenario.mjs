import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

// 테스트 안전 레일(ED5 #2) — 끝나지 않는 자동 실행이 화면 알림과 구조화 기록(__oprnSafetyStops)으로 멈추는가.
//   node scripts/runtime-qa.mjs --scenario safety-stop
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/safety-stop-");
const fixture = join(temporary, "project.json");
process.on("exit", () => rmSync(temporary, { recursive: true, force: true }));
execFileSync(process.execPath, ["node_modules/vite-node/dist/cli.mjs", "--script", "scripts/qa/runtime/safety-stop-fixture.mts", "--out", fixture], { stdio: "inherit" });

const stopsOf = (kind, eventId) => `() => {
  const stops = window.__oprnSafetyStops?.() ?? [];
  return stops.some((stop) => stop.kind === ${JSON.stringify(kind)} && stop.eventId === ${JSON.stringify(eventId)}) || JSON.stringify(stops);
}`;

export default {
  id: "safety-stop",
  projectFixture: fixture,
  viewport: process.env.QA_VIEWPORT === "390" ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  beats: [
    { id: "title", expect: { testidPresent: ["title-screen"] } },
    {
      id: "autorun-stopped",
      note: "새 게임 → 같은 맵으로 옮기는 자동 실행이 상한에서 멈추고 이유가 보인다. 플레이어는 다시 움직일 수 있다",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, { kind: "waitForVisible", testid: "runtime-safety-stop", timeoutMs: 20000 }],
      expect: {
        visibleText: { "runtime-safety-stop": "ev_autorun_loop" },
        pageAssertions: [{ id: "autorun-stop-record", fn: stopsOf("autorun-repeat", "ev_autorun_loop") }],
      },
      shot: true,
    },
    {
      id: "endless-loop-stopped",
      note: "탈출 없는 반복을 조사하면 명령 예산에서 멈추고 기록이 남는다(반복 예산 10만 회보다 명령 예산이 먼저 찬다)",
      ops: [{ kind: "face", dir: "up" }, { kind: "action" }, { kind: "waitForBodyText", text: "명령을 100000번", timeoutMs: 30000 }],
      expect: {
        visibleText: { "runtime-safety-stop": "ev_endless_loop" },
        pageAssertions: [{ id: "loop-stop-record", fn: stopsOf("instruction-budget", "ev_endless_loop") }],
      },
      shot: true,
    },
  ],
};

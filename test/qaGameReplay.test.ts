import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildBrowserSeed, type QaBrief } from "../scripts/qa-game/lib/seed";
import { formatReplaySummary, replayRecording, warningDelta } from "../scripts/qa-game/replay.mts";
import { readRecordedCalls } from "../scripts/qa-game/lib/recorder";
import { serialize } from "../src/project/io";

const brief = JSON.parse(fs.readFileSync("scripts/qa-game/briefs/lighthouse-jrpg.json", "utf8")) as QaBrief;
// 실제 gen 런(lighthouse-1)에서 뽑은 build 호출 13개: #41~#52(세계관·인물·장비·배우·파티·적·부대) + #57 define_ending.
const SAMPLE = "test/fixtures/qaGame/replay-lighthouse-sample.jsonl";

function recordingDir(mutate?: (lines: Record<string, unknown>[]) => void): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qa-replay-"));
  fs.writeFileSync(path.join(dir, "seed.json"), serialize(buildBrowserSeed(brief).project));
  const lines = fs.readFileSync(SAMPLE, "utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  mutate?.(lines);
  fs.writeFileSync(path.join(dir, "tools.jsonl"), `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`);
  return dir;
}

describe("qa-game replay — 녹화한 툴 호출을 지금 코드로 다시 돌린다", () => {
  it("같은 씨앗 위에서 녹화대로 반영하고, 녹화와 ok·경고가 다른 호출만 보고한다", async () => {
    // 녹화를 두 군데 비튼다 — 나머지 11개는 지금 코드로 돌려도 녹화와 같아야 한다.
    const dir = recordingDir((lines) => {
      lines.find((line) => line.order === 49)!.ok = false; // set_party 가 녹화 때는 실패했다고 치자
      lines.find((line) => line.order === 47)!.warnings = ["옛 경고"];
    });
    const result = await replayRecording(dir);
    expect(result.calls.every((call) => call.status === "ran" && call.ok)).toBe(true);
    expect(result.calls.filter((call) => call.differs).map((call) => call.order)).toEqual([47, 49]);
    expect(result.project.database.actors.some((actor) => actor.id === "actor_scout")).toBe(true);
    expect(result.project.database.troops.some((troop) => troop.id === "troop_blizzard_spirit")).toBe(true);
    expect(result.publications).toBeGreaterThan(0);
    const summary = formatReplaySummary(result, readRecordedCalls(path.join(dir, "tools.jsonl")));
    expect(summary).toContain("재생 성공 13/13");
    expect(summary).toContain("ok false→true");
    expect(summary).toContain("- 옛 경고");
  }, 90_000);

  it("경고 차이는 다중집합으로 센다", () => {
    expect(warningDelta(["a", "a", "b"], ["a", "c"])).toEqual([["-", "a"], ["-", "b"], ["+", "c"]]);
  });
});

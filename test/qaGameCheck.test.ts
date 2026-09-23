import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { runGameCheck } from "@/qa/gameCheck";
import { deserialize, serialize } from "@/project/io";
import { buildQaFixture, type QaFixtureName } from "./fixtures/qaGame/qaGameFixtures";

// 픽스처는 저장·다시 읽기를 거친다 — 검사기는 로더가 돌려준 모양(런타임이 보는 모양)을 본다.
function check(name: QaFixtureName) {
  const project = deserialize(serialize(buildQaFixture(name)));
  return runGameCheck(project, { autoPlayBudgetMs: 20_000 });
}
const codes = (report: ReturnType<typeof check>, severity = "blocker") =>
  report.findings.filter((finding) => finding.severity === severity).map((finding) => finding.code);

describe("qa gameCheck (모델 없는 게임 검사기)", () => {
  it("깨끗한 픽스처는 막힘 없이 엔딩까지 자동 플레이된다(동료 합류 경로 포함)", () => {
    const report = check("clean");
    expect(codes(report)).toEqual([]);
    expect(report.autoPlay?.runs.map((run) => [run.label, run.ok, run.endingReached])).toEqual([
      ["기본 경로", true, "ending_light"],
      ["동료 합류 후", true, "ending_light"],
    ]);
    expect(report.autoPlay?.runs[1]?.partyAtEnd).toEqual(["actor_hero", "actor_scout"]);
    expect(report.maps.every((map) => map.reachable)).toBe(true);
  });

  it("빈 선택지 분기를 막힘으로 잡는다", () => {
    const report = check("emptyChoices");
    expect(codes(report)).toContain("choice-all-empty");
    const finding = report.findings.find((f) => f.code === "choice-all-empty")!;
    expect(finding.where).toMatchObject({ mapId: "map_blank_start", eventId: "ev_kai", pageIndex: 0, path: "commands[1]" });
  });

  it("changeParty 의 speciesId 를 잡고, 동료 합류 실패를 자동 플레이로 재현한다(원본 JSON)", () => {
    // 로더는 이제 speciesId 를 actorId 로 옮긴다(#1191) — 생성기가 쓴 그대로(원본)를 검사해야 결함이 보인다.
    const report = runGameCheck(JSON.parse(serialize(buildQaFixture("speciesIdParty"))), { autoPlayBudgetMs: 20_000 });
    expect(codes(report)).toEqual(expect.arrayContaining(["command-missing-required", "autoplay-failed"]));
    expect(report.findings.some((f) => f.code === "command-unknown-field" && f.message.includes("speciesId"))).toBe(true);
    const companion = report.autoPlay!.runs.find((run) => run.label === "동료 합류 후")!;
    expect(companion.ok).toBe(false);
    // 옛 런타임은 파티에 null 을 넣고 전투가 Missing actor 로 멈췄다. #1191 뒤 런타임은 없는 배우를 건너뛴다 — 어느 쪽이든 합류 실패로 잡힌다.
    expect(companion.failure?.detail).toMatch(/없는 배우|파티가 늘지/u);
    // 동료 없이 가는 기본 경로는 여전히 끝까지 간다 — 결함이 동료 합류에 있다는 증거.
    expect(report.autoPlay!.runs.find((run) => run.label === "기본 경로")?.ok).toBe(true);
  });

  it("로더가 고친 명령은 load-normalized 경고로 남는다(생성기 결함의 흔적)", () => {
    const text = serialize(buildQaFixture("speciesIdParty"));
    const report = runGameCheck(deserialize(text), { rawProject: JSON.parse(text), skipAutoPlay: true });
    const normalized = report.findings.filter((f) => f.code === "load-normalized");
    if (normalized.length === 0) {
      // 로더가 아직 고치지 않는 판(옛 main)이면 원본 그대로 막힘으로 잡힌다.
      expect(codes(report)).toContain("command-missing-required");
    } else {
      expect(normalized[0]!.message).toContain("speciesId");
      expect(normalized[0]!.where?.eventId).toBe("ev_kai");
    }
  });

  it("엔딩 페이지를 여는 스위치를 켜는 곳이 없으면 막힘 + 자동 플레이 실패", () => {
    const report = check("endingSwitchUnset");
    expect(codes(report)).toEqual(expect.arrayContaining(["ending-page-switch-never-set", "autoplay-failed"]));
    const base = report.autoPlay!.runs[0]!;
    expect(base.ok).toBe(false);
    expect(base.steps.some((step) => step.detail.includes("찾지 못했습니다") || step.detail.includes("충족되지"))).toBe(true);
  });

  it("빈 껍데기 맵과 못 가는 맵을 잡는다", () => {
    const report = check("orphanMaps");
    const orphan = report.findings.find((f) => f.code === "orphan-empty-map")!;
    expect(orphan.severity).toBe("blocker");
    expect(orphan.where?.mapId).toBe("map_frozen_cave");
    const unreachable = report.findings.find((f) => f.code === "unreachable-map")!;
    expect(unreachable.where?.mapId).toBe("map_lighthouse");
    expect(report.maps.find((map) => map.id === "map_lighthouse")?.reachable).toBe(false);
  });

  it("엔딩을 부르는 곳이 하나도 없으면 막힘", () => {
    const project = deserialize(serialize(buildQaFixture("clean")));
    for (const map of Object.values(project.maps)) for (const e of map.events) for (const p of e.pages ?? []) p.commands = p.commands.filter((c) => c.kind !== "triggerEnding");
    expect(codes(runGameCheck(project, { skipAutoPlay: true }))).toContain("no-ending-trigger");
  });

  it("보스전이 선택지로 바뀌어 전투가 없으면, 같은 이름의 안 쓰인 적 그룹을 짚는다(실제 gen 런 lighthouse-1)", () => {
    const project = deserialize(serialize(buildQaFixture("clean")));
    const boss = project.maps.map_cave!.events.find((e) => e.id === "ev_boss")!;
    const battle = boss.pages[0]!.commands[0] as { victoryBranch: unknown[] };
    boss.pages[0]!.commands = [{ kind: "choices", options: [{ text: "맞서 싸운다", branch: battle.victoryBranch }, { text: "물러선다", branch: [{ kind: "text", body: "..." }] }] }] as never;
    project.database.troops.push({ ...project.database.troops.find((t) => t.id === "troop_slime")!, id: "troop_blizzard_spirit", name: "눈보라 정령" });
    const report = runGameCheck(project, { skipAutoPlay: true, briefText: "등대를 얼린 보스 눈보라 정령을 물리친다" });
    const finding = report.findings.find((f) => f.code === "brief-no-boss");
    expect(finding?.message).toContain("눈보라 정령(troop_blizzard_spirit)");
    expect(finding?.message).not.toContain("troop_slime");
  });

  // 3차 재시험 워크스페이스의 읽기 전용 내보내기(node scripts/oprn-store.mjs export-json …). 없으면 건너뛴다.
  const RETEST3 = "/tmp/qa-retest3.json";
  it.skipIf(!fs.existsSync(RETEST3))("3차 재시험 내보내기에서 speciesId/null 파티 막힘을 잡는다", () => {
    const report = runGameCheck(JSON.parse(fs.readFileSync(RETEST3, "utf8")), { autoPlayBudgetMs: 30_000 });
    expect(report.findings.some((f) => f.code === "command-missing-required" && f.where?.eventId === "ev_companion_kai")).toBe(true);
    const companion = report.autoPlay!.runs.find((run) => run.label === "동료 합류 후")!;
    expect(companion.failure?.detail).toMatch(/없는 배우|파티가 늘지/u);
  }, 60_000);
});

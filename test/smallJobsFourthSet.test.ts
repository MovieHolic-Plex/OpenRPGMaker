import { describe, expect, it } from "vitest";
import { runCheck } from "@/harnesses/assistant-capability/node/smallJobs/checks";
import { buildFixture } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import { applyCalls, loadSuite, suiteFile, type SmallJob } from "@/harnesses/assistant-capability/node/smallJobs/suite";
import { referenceIndex } from "@/editor/tools/dbReferenceIndex";
import { unusedRecords } from "@/editor/tools/dbRecordDelete";
import type { Project } from "@/project/types";

// 작은 일 넷째 묶음(small-jobs-4.json — 자료집 고치기, 2026-11-16 자료집 적대 리뷰 B 의 오너 문장 여섯 + 목록 비우기 + 자동 전투 끄기)의 판정기.
// 자기검사(small-jobs-selfcheck --set 4)와 같은 것을 CI 에서 본다. 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).

describe("넷째 묶음 — 자료집 고치기", () => {
  const fourth = loadSuite(suiteFile("4"));
  const fixture = buildFixture("dbsmall");
  it("dbsmall 픽스처: 끊긴 참조가 없고, 안 쓰는 스킬·아이템이 있다", () => {
    const ids = new Set<string>();
    for (const table of ["actors", "classes", "skills", "items", "equipment", "enemies", "troops", "states"] as const) for (const row of fixture.database[table]) ids.add(row.id);
    const full = buildFixture("blank");
    const gone = new Set<string>();
    for (const table of ["actors", "classes", "skills", "items", "equipment", "enemies", "troops", "states"] as const) for (const row of full.database[table]) if (!ids.has(row.id)) gone.add(row.id);
    expect([...referenceIndex(fixture, gone).keys()]).toEqual([]);
    const unused = unusedRecords(fixture, ["skills", "items"]);
    expect(unused.get("skills")!.length).toBeGreaterThan(0);
    expect(unused.get("items")!.length).toBeGreaterThan(0);
    expect(fixture.database.skills.length).toBeLessThan(200);
  });
  it("오너 문장 여섯과 목록 비우기 · 자동 전투 끄기가 있다", () => {
    expect(fourth.jobs.map((job) => job.id)).toEqual(["db-delete-unused", "db-delete-unused-full", "db-enemy-hp-exp", "db-rename-price", "db-class-skills", "db-terms", "db-theme-rewrite", "db-clear-list", "db-auto-battle-off"]);
    expect(fourth.jobs.filter((job) => job.fixture !== "dbsmall").map((job) => job.id)).toEqual(["db-delete-unused-full"]);
  });
  it("기본 크기 자료집에서 안 쓰는 것 지우기는 호출 상한이 있고, 손 정답은 한 번이다", () => {
    const job = fourth.jobs.find((entry) => entry.id === "db-delete-unused-full")!;
    expect(job.maxToolCalls).toBeLessThanOrEqual(20);
    expect(job.reference).toHaveLength(1);
    const blank = buildFixture("blank");
    expect(runCheck(job.check, job.allow, blank, applyCalls(blank, job.reference)).pass).toBe(true);
  }, 300_000);
  const problemsOf = (job: SmallJob, base: Project): string[] => {
    const problems: string[] = [];
    const verdict = (calls: SmallJob["reference"]) => runCheck(job.check, job.allow, base, applyCalls(base, calls));
    if (runCheck(job.check, job.allow, base, base).pass) problems.push(`${job.id}: 손대지 않은 픽스처가 합격`);
    const reference = verdict(job.reference);
    if (!reference.pass) problems.push(`${job.id}: 손 정답이 불합격 — ${reference.reason}`);
    for (const other of job.accept ?? []) { const result = verdict(other.calls); if (!result.pass) problems.push(`${job.id}: 다른 모양의 정답 「${other.note}」이 불합격 — ${result.reason}`); }
    for (const wrong of job.wrong) { const result = verdict(wrong.calls); if (result.pass) problems.push(`${job.id}: 오답 「${wrong.note}」이 합격 — ${result.reason}`); }
    return problems;
  };
  it("손대지 않으면 불합격, 손 정답·다른 모양의 정답은 합격, 오답은 불합격", () => {
    expect(fourth.jobs.filter((job) => job.fixture === "dbsmall").flatMap((job) => problemsOf(job, fixture))).toEqual([]);
  }, 600_000);
  it("직업 배움표를 통째로 덮어 줄인 것은 불합격이다(B #5)", () => {
    const job = fourth.jobs.find((entry) => entry.id === "db-class-skills")!;
    const wipe = job.wrong.find((entry) => entry.note.includes("배움표"))!;
    expect(runCheck(job.check, job.allow, fixture, applyCalls(fixture, wipe.calls)).reason).toContain("줄었다");
  });
});

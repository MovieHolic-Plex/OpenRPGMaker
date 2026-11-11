import { describe, expect, it } from "vitest";
import { runCheck } from "@/harnesses/assistant-capability/node/smallJobs/checks";
import { freshSession, interact, playPaths } from "@/harnesses/assistant-capability/node/smallJobs/checkSupport";
import { buildFixture, FIXTURE_IDS, type FixtureId } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import { applyCalls, loadSuite, suiteFile, type SmallJob } from "@/harnesses/assistant-capability/node/smallJobs/suite";
import type { Project } from "@/project/types";

// 작은 일 셋째 묶음(small-jobs-3.json — JRPG 가 아닌 게임의 장치)의 판정기. 자기검사(small-jobs-selfcheck --set 3)와 같은 것을 CI 에서 본다:
// 손대지 않은 픽스처는 불합격, 손 정답(실제 도구 호출)과 다른 모양의 정답은 합격, 그럴듯한 오답은 불합격.

describe("셋째 묶음 고르기", () => {
  const third = loadSuite(suiteFile("3"));
  it("--set 3 으로 고른다: 앞 묶음과 id 가 겹치지 않고 세 픽스처·모든 가족을 쓴다", () => {
    const earlier = new Set([...loadSuite(suiteFile("1")).jobs, ...loadSuite(suiteFile("2")).jobs].map((job) => job.id));
    expect(third.jobs.length).toBeGreaterThanOrEqual(35);
    expect(third.jobs.filter((job) => earlier.has(job.id))).toEqual([]);
    expect(new Set(third.jobs.map((job) => job.fixture))).toEqual(new Set(FIXTURE_IDS));
    expect(Object.keys(third.families).filter((family) => !third.jobs.some((job) => job.family === family))).toEqual([]);
  });
  it("일마다 오답이 둘 이상이다(판정이 걸러야 할 것을 적어 둔다)", () => {
    expect(third.jobs.filter((job) => job.wrong.length < 2).map((job) => job.id)).toEqual([]);
  });
});

/** 일 하나의 판정이 어긋난 곳(없으면 빈 배열). */
function problemsOf(job: SmallJob, fixture: Project): string[] {
  const problems: string[] = [];
  const verdict = (calls: SmallJob["reference"]) => runCheck(job.check, job.allow, fixture, applyCalls(fixture, calls));
  const untouched = runCheck(job.check, job.allow, fixture, fixture);
  if (untouched.pass) problems.push(`${job.id}: 손대지 않은 픽스처가 합격 — ${untouched.reason}`);
  const reference = verdict(job.reference);
  if (!reference.pass) problems.push(`${job.id}: 손 정답이 불합격 — ${reference.reason}`);
  for (const other of job.accept ?? []) { const result = verdict(other.calls); if (!result.pass) problems.push(`${job.id}: 다른 모양의 정답 「${other.note}」이 불합격 — ${result.reason}`); }
  for (const wrong of job.wrong) { const result = verdict(wrong.calls); if (result.pass) problems.push(`${job.id}: 오답 「${wrong.note}」이 합격 — ${result.reason}`); }
  return problems;
}

describe("셋째 묶음 판정 — 손대지 않으면 불합격, 손 정답은 합격, 오답은 불합격", () => {
  const third = loadSuite(suiteFile("3"));
  for (const id of FIXTURE_IDS) {
    it(`${id} 픽스처의 일 ${third.jobs.filter((job) => job.fixture === id).length}개`, () => {
      const fixture = buildFixture(id as FixtureId);
      expect(third.jobs.filter((job) => job.fixture === id).flatMap((job) => problemsOf(job, fixture))).toEqual([]);
    }, 900_000);
  }
});

describe("말 걸기 따라가기 — 장르 장치", () => {
  const say = (body: string) => ({ kind: "text", body });
  it("물건 내밀기는 가진 후보마다 한 갈래 + 닫기다 — 맞는 물건이면 그 가지, 아니면 otherwise, 닫으면 cancel", () => {
    const event = { id: "ev_p", x: 0, y: 0, commands: [{ kind: "presentItem", options: [{ itemId: "key", branch: [say("자백")] }], otherwiseBranch: [say("상관없다")], cancelBranch: [say("그만둔다")], consume: true }] };
    const paths = playPaths(event, () => freshSession({ key: 1, potion: 1 }), {});
    expect(paths.map((path) => `${path.presented.join("")}:${path.texts.join("")}`).sort()).toEqual([":그만둔다", "key:자백", "potion:상관없다"]);
    expect(paths.find((path) => path.presented[0] === "key")!.session.inventory.key).toBe(0);
    // 내밀 것이 없으면 묻지 않고 닫은 것으로 친다. picks 없이 부르면(앞 묶음의 방식) 건드리지 않는다.
    expect(playPaths(event, freshSession, {}).map((path) => path.texts)).toEqual([["그만둔다"]]);
    expect(interact(event, freshSession({ key: 1 })).texts).toEqual([]);
  });
  it("halt 를 주면 엔딩·게임 오버에서 멈추고, 조건이 거짓인 엔딩은 지나간다", () => {
    const doc = { endings: [{ id: "happy", name: "행복", conditions: [{ kind: "friendshipAtLeast", npcKey: "masa", value: 3 }] }] };
    const event = { id: "ev_e", x: 0, y: 0, commands: [{ kind: "triggerEnding", endingId: "happy" }, say("아직은…"), { kind: "gameOver" }, say("안 나온다")] };
    expect(interact(event, freshSession(), doc, { halt: true })).toMatchObject({ texts: ["아직은…"], ended: { kind: "gameOver" } });
    expect(interact(event, Object.assign(freshSession(), { friendship: { masa: 3 } }), doc, { halt: true })).toMatchObject({ texts: [], ended: { kind: "ending", endingId: "happy" } });
    // halt 없이는 끝까지 돈다(앞 묶음의 판정이 쓰는 방식).
    expect(interact(event, freshSession(), doc).texts).toEqual(["아직은…", "안 나온다"]);
  });
  it("호감도는 이벤트의 characterId(또는 적은 npcKey)에 쌓인다", () => {
    const event = { id: "ev_f", x: 0, y: 0, characterId: "mina", commands: [{ kind: "changeFriendship", delta: 2 }, { kind: "fork", condition: { kind: "friendshipAtLeast", value: 4 }, then: [say("가까워졌다")], else: [say("아직 서먹하다")] }] };
    const session = freshSession();
    expect(interact(event, session).texts).toEqual(["아직 서먹하다"]);
    expect(interact(event, session).texts).toEqual(["가까워졌다"]);
    expect(session.friendship).toEqual({ mina: 4 });
  });
  it("라벨로 되돌아가는 선택(「아니오」면 처음부터)을 길로 센다 — 두 번까지", () => {
    const event = { id: "ev_g", x: 0, y: 0, commands: [{ kind: "label", name: "pick" }, { kind: "choices", options: [
      { text: "받는다", branch: [{ kind: "giveMonster", speciesId: "leaf" }] }, { text: "다시", branch: [{ kind: "gotoLabel", name: "pick" }] }] }] };
    const paths = playPaths(event, freshSession, {});
    expect(paths.filter((path) => path.monsters.length === 1).map((path) => path.picked.join(">")).sort()).toEqual(["다시>다시>받는다", "다시>받는다", "받는다"]);
    expect(paths.every((path) => path.monsters.length <= 1)).toBe(true);
  });
  it("타이머 명령은 남은 시간을 적고, 숫자 입력은 enter 가 준 값을 변수에 넣는다", () => {
    const event = { id: "ev_t", x: 0, y: 0, commands: [{ kind: "timer", action: "set", seconds: 30, timerId: "timer1" }, { kind: "timer", action: "start", timerId: "timer1" },
      { kind: "inputNumber", variableId: "v", digits: 4 }, { kind: "fork", condition: { kind: "variable", variableId: "v", op: "==", value: 427 }, then: [say("열렸다")], else: [say("틀렸다")] }] };
    const session = freshSession();
    expect(interact(event, session, {}, { picks: [], enter: () => 427 }).texts).toEqual(["열렸다"]);
    expect(session.timers).toEqual({ timer1: 30 });
    expect(session.timerRunning).toEqual({ timer1: true });
    expect(interact(event, freshSession()).texts).toEqual(["틀렸다"]);
  });
});

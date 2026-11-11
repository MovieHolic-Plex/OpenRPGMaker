import { describe, expect, it } from "vitest";
import { runCheck } from "@/harnesses/assistant-capability/node/smallJobs/checks";
import { freshSession, interact, playPaths } from "@/harnesses/assistant-capability/node/smallJobs/checkSupport";
import { buildFixture, FIXTURE_IDS, type FixtureId } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import { applyCalls, loadSuite, selectJobs, suiteFile, SUITE_FILE, type SmallJob } from "@/harnesses/assistant-capability/node/smallJobs/suite";
import type { Project } from "@/project/types";

// 작은 일 둘째 묶음(small-jobs-2.json)의 판정기. 자기검사(small-jobs-selfcheck --set 2)와 같은 것을 CI 에서 본다:
// 손대지 않은 픽스처는 불합격, 손 정답(실제 도구 호출)과 다른 모양의 정답은 합격, 그럴듯한 오답은 불합격.

const FIRST_SET_IDS = [
  "move-npc-left2", "move-npc-door-front", "move-npc-next-to", "add-npc-line-starter", "add-npc-near-built", "add-npc-blank", "shopkeeper-blank",
  "shopkeeper-items-starter", "shop-existing-npc-built", "chest-potion3-starter", "chest-gold-built", "pickup-key-built", "sign-starter", "sign-ending-built",
  "examine-fireplace-built", "door-roundtrip-starter", "door-backdoor-built", "edit-line-built", "edit-inn-price-starter", "rename-title-built", "rename-map-starter",
  "rename-npc-built", "bgm-same-as-built", "bgm-add-starter", "encounter-foe-built", "encounter-slimes-starter", "give-key-once-starter", "key-gated-door-built",
  "dress-trees-starter", "dress-snowfield-built",
];

describe("작은 일 묶음 고르기", () => {
  it("첫 묶음은 그대로다 — 30가지, id 와 순서(기준선 비교의 기준)", () => {
    expect(loadSuite(SUITE_FILE).jobs.map((job) => job.id)).toEqual(FIRST_SET_IDS);
    expect(suiteFile(undefined)).toBe(SUITE_FILE);
    expect(suiteFile("1")).toBe(SUITE_FILE);
  });
  it("둘째 묶음은 --set 2 로 고른다: 첫 묶음과 id 가 겹치지 않고 세 픽스처를 모두 쓴다", () => {
    const second = loadSuite(suiteFile("2"));
    expect(second.jobs.length).toBeGreaterThanOrEqual(30);
    expect(second.jobs.filter((job) => FIRST_SET_IDS.includes(job.id))).toEqual([]);
    expect(new Set(second.jobs.map((job) => job.fixture))).toEqual(new Set(FIXTURE_IDS));
    expect(Object.keys(second.families).filter((family) => !second.jobs.some((job) => job.family === family))).toEqual([]);
    expect(selectJobs(second, "save").map((job) => job.family)).toEqual(["save", "save"]);
    expect(() => suiteFile("9")).toThrow(/없는 묶음/u);
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

describe("둘째 묶음 판정 — 손대지 않으면 불합격, 손 정답은 합격, 오답은 불합격", () => {
  const second = loadSuite(suiteFile("2"));
  for (const id of FIXTURE_IDS) {
    it(`${id} 픽스처의 일 ${second.jobs.filter((job) => job.fixture === id).length}개`, () => {
      const fixture = buildFixture(id as FixtureId);
      const problems = second.jobs.filter((job) => job.fixture === id).flatMap((job) => problemsOf(job, fixture));
      expect(problems).toEqual([]);
    }, 600_000);
  }
  it("시작 위치를 옮기는 일만 시작 위치 변경을 눈감아 준다", () => {
    const fixture = buildFixture("starter");
    const moved = applyCalls(fixture, [{ tool: "set_start_position", args: { mapId: "map_ember_village", x: 6, y: 10 } }, { tool: "upsert_item", args: { item: { id: "item_potion", price: 80 } } }]);
    const price = second.jobs.find((job) => job.id === "item-price-starter")!, start = second.jobs.find((job) => job.id === "start-near-npc-starter")!;
    expect(runCheck(price.check, price.allow, fixture, moved)).toMatchObject({ pass: false, outcome: { ok: true } });
    expect(runCheck(start.check, start.allow, fixture, moved)).toMatchObject({ pass: true });
  }, 120_000);
});

describe("말 걸기 따라가기 — 갈림을 길마다", () => {
  const say = (body: string) => ({ kind: "text", body });
  const event = { id: "ev_t", x: 0, y: 0, commands: [
    say("묵고 갈래?"),
    { kind: "choices", prompt: "어떻게 할까?", options: [
      { text: "예", branch: [{ kind: "changeGold", op: "-=", amount: 10 }, { kind: "recoverAll" }, say("푹 쉬었다.")] },
      { text: "아니오", branch: [say("다음에.")] },
    ] },
    { kind: "inn", price: 30 },
  ] };
  it("picks 없이 부르면 선택지의 모든 갈래를 합친다(첫 묶음의 판정이 쓰는 방식) — 여관은 건드리지 않는다", () => {
    const play = interact(event, freshSession());
    expect(play.texts).toEqual(["묵고 갈래?", "푹 쉬었다.", "다음에."]);
    expect(play.gold).toBe(-10);
    expect(play.arity).toEqual([]);
  });
  it("playPaths 는 선택지 × 여관의 모든 길을 한 번씩 따라간다", () => {
    const paths = playPaths(event, () => Object.assign(freshSession(), { gold: 100 }), {});
    expect(paths.map((path) => path.picked.join(">")).sort()).toEqual(["아니오>(여관) 거절", "아니오>(여관) 묵는다", "예>(여관) 거절", "예>(여관) 묵는다"]);
    const yesStay = paths.find((path) => path.picked.join(">") === "예>(여관) 묵는다")!;
    expect(yesStay).toMatchObject({ gold: -40, recovered: true, prompts: ["어떻게 할까?"] });
    expect(paths.find((path) => path.picked.join(">") === "아니오>(여관) 거절")).toMatchObject({ gold: 0, recovered: false, texts: ["묵고 갈래?", "다음에."] });
  });
  it("battle:'victory' 를 주면 이긴 뒤의 분기를 잇고, 주지 않으면 잇지 않는다", () => {
    const boss = { id: "ev_b", x: 0, y: 0, commands: [{ kind: "battleProcessing", troopId: "t", victoryBranch: [say("이겼다.")] }] };
    expect(interact(boss, freshSession()).texts).toEqual([]);
    expect(interact(boss, freshSession(), {}, { battle: "victory" }).texts).toEqual(["이겼다."]);
  });
});

// 퀘스트 후보 탐지기 — 저장된 게임에서 뽑은 축소 프로젝트(test/fixtures/quest-candidates/projects)와
// 사람이 먼저 판정한 정답표(labels)를 맞춘다. 큰 참고 게임 셋은 크기 때문에 여기 없고
// scripts/content/measure-quest-candidates.mts 로 잰다(openwiki/quest-register.md).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { findQuestCandidates, pendingQuestCandidates, registerQuestCandidate } from "@/project/quest/questCandidates";
import { buildQuestLog } from "@/player/questLog";
import { runGameCheck } from "@/qa/gameCheck";
import type { Project } from "@/project/types";

const DIR = fileURLToPath(new URL("./fixtures/quest-candidates", import.meta.url));
interface Ref { mapId: string; eventId: string }
interface Label { quests: { id: string; giver: Ref; turnIn: Ref[]; stepEvents: Ref[] }[] }

const games = readdirSync(join(DIR, "projects")).map((file) => file.replace(/\.json$/, "")).sort();
type FixtureMap = { id: string; name: string; events: Project["maps"][string]["events"] };

function project(game: string): Project {
  const raw = JSON.parse(readFileSync(join(DIR, "projects", `${game}.json`), "utf8")) as { maps: Record<string, FixtureMap>; quests: Project["quests"] };
  const ctx = { project: createEmptyToolProject(game) };
  const maps = Object.values(raw.maps);
  for (const map of maps) {
    const width = Math.max(20, ...map.events.map((event) => event.x + 2));
    const height = Math.max(15, ...map.events.map((event) => event.y + 2));
    const result = runTool(ctx, "create_map", { name: map.name || map.id, width, height, id: map.id });
    if (!result.ok) throw new Error(result.summary);
  }
  for (const map of maps) ctx.project.maps[map.id]!.events = map.events;
  ctx.project.quests = raw.quests;
  return ctx.project;
}
const label = (game: string): Label => JSON.parse(readFileSync(join(DIR, "labels", `${game}.json`), "utf8")) as Label;
const key = (ref: Ref) => `${ref.mapId}/${ref.eventId}`;

function verdicts(game: string): { matched: string[]; falsePositives: string[] } {
  const truth = label(game).quests;
  const matched: string[] = [];
  const falsePositives: string[] = [];
  for (const candidate of pendingQuestCandidates(project(game))) {
    const refs = new Set([candidate.giver, candidate.turnIn, ...candidate.steps].map(key));
    const hit = truth.find((quest) => !matched.includes(quest.id) && [quest.giver, ...quest.turnIn, ...quest.stepEvents].some((ref) => refs.has(key(ref))));
    if (hit) matched.push(hit.id); else falsePositives.push(candidate.giver.eventId);
  }
  return { matched: matched.sort(), falsePositives };
}

describe("퀘스트 후보 — 저장된 게임 14개 정답표", () => {
  it("게임마다 맞힌 퀘스트와 오탐이 기록과 같다", () => {
    const table = Object.fromEntries(games.map((game) => [game, verdicts(game)]));
    expect(table).toEqual({
      "L6__L__fun-cat-1": { matched: ["moon_spring"], falsePositives: [] },
      "batch1__B-high__fun-cat-1": { matched: ["momo_star"], falsePositives: [] },
      "batch1__B-high__fun-plain-1": { matched: ["missing_cake"], falsePositives: [] },
      "batch1__B-high__fun-village-1": { matched: ["star_shard"], falsePositives: [] },
      "batch1__B-medium__fun-cat-1": { matched: ["cat_star"], falsePositives: [] },
      "batch1__B-medium__fun-plain-1": { matched: [], falsePositives: [] },
      "batch1__B-medium__fun-village-1": { matched: [], falsePositives: [] },
      "batch2__B-high__fun-cat-1": { matched: [], falsePositives: [] },
      "batch2__B-high__fun-plain-1": { matched: [], falsePositives: [] },
      "batch2__B-high__fun-village-1": { matched: ["wind_lights"], falsePositives: [] },
      "batch2__B-medium__fun-cat-1": { matched: [], falsePositives: [] },
      "batch2__B-medium__fun-plain-1": { matched: ["star_machine"], falsePositives: [] },
      "batch2__B-medium__fun-village-1": { matched: ["star_lights"], falsePositives: [] },
      "ref_shitamachi-fourth-season": { matched: ["wish_lanterns"], falsePositives: [] },
    });
  });

  it("한 번 등록하면 퀘스트 로그가 차고, 그 흐름은 더 제안되지 않는다", () => {
    const game = project("batch1__B-medium__fun-cat-1");
    expect(buildQuestLog(game, game.session)).toHaveLength(0);
    const [candidate] = pendingQuestCandidates(game);
    expect(candidate!.draft!.nodes.map((node) => node.completesWhen)).toEqual([{ kind: "switch", switchId: "sw_cat_star", value: true }]);
    registerQuestCandidate(game, candidate!);
    const log = buildQuestLog(game, game.session);
    expect(log.map((entry) => [entry.key, entry.state])).toEqual([[candidate!.id, "not-started"]]);
    expect(buildQuestLog(game, { ...game.session, switches: { ...game.session.switches, sw_cat_star: true } })[0]!.state).toBe("done");
    expect(findQuestCandidates(game).find((entry) => entry.id === candidate!.id)!.registeredAs).toBe(candidate!.id);
    expect(pendingQuestCandidates(game)).toHaveLength(0);
  });

  it("qa:game 검사는 퀘스트 0개 + 후보가 있을 때만 경고(막힘 아님)를 낸다", () => {
    const code = (game: Project) => runGameCheck(game, { skipAutoPlay: true }).findings.filter((finding) => finding.code === "quest-unregistered").map((finding) => finding.severity);
    const withCandidate = project("batch1__B-medium__fun-cat-1");
    expect(code(withCandidate)).toEqual(["warning"]);
    expect(code(project("batch2__B-high__fun-cat-1"))).toEqual([]);
    registerQuestCandidate(withCandidate, pendingQuestCandidates(withCandidate)[0]!);
    expect(code(withCandidate)).toEqual([]);
  });
});

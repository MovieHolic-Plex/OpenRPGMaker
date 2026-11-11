import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { buildPuzzleChain, type ChainLink } from "@/ai/v2/story/puzzle";
import { MIN_ACT_DEPTH, progressionDepth } from "@/ai/v2/judge/actDepth";
import { actDepthMinBlocker } from "@/ai/v2/judge/shipChecks";
import { walkBlueprint } from "@/ai/v2/story/blueprint";
import type { ToolContext } from "@/editor/tools/types";
import type { Project } from "@/project/types";

// 2026-11-12 Terra 측정 r1-fun(눈가림 재미 2 — 첫 마을에서 막힘)의 두 원인.
//  1) 같은 이름의 사슬을 두 번에 나눠 지으면(청사진을 다시 쓰고 경로를 다시 지으면 새 단계만 온다) 고리 스위치 번호가 호출마다 1 부터라
//     뒤 호출의 첫 사람이 앞 호출 첫 사람의 «집어 감» 스위치를 같이 썼다 — 앞 사람과 말하면 뒤 사람이 «받은 뒤» 대사로 넘어가 길을 여는 스위치를 켜지 않았다.
//  2) 그 다시 쓰기를 시킨 것은 act-depth-min 관문이었다 — 7단계 경로를 다 지었는데 가운데 단계 하나가 물건으로 넘겨 깊이가 3 으로 재어졌다.
// 재는 법(모델 없음): /tmp 탐침 chainslot.mts · depthguard.mts 와 같은 호출. 문서 openwiki/assistant-v2.md 「사슬 고리 번호는 고리의 것」.

const CHAIN = "달샘과 잠든 태양";
function start(): { ctx: ToolContext; build: (links: ChainLink[]) => ReturnType<typeof buildPuzzleChain> } {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  return { ctx, build: (links) => buildPuzzleChain(createBuildRun(ctx), { mapId: ctx.project.startMapId, name: CHAIN, links }) };
}
/** 이벤트마다: 그 이벤트 페이지에 든 고리 몫 스위치·변수(집어 감 · 풀림 · 문 열림 · 입력한 번호 · 틀린 횟수). */
function perLinkIds(project: Project): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    const ids = [...new Set([...JSON.stringify(ev.pages ?? []).matchAll(/"((?:sw_[a-z0-9]+_(?:taken|door_open|[a-z0-9_]+_solved)|var_[a-z0-9]+)_\d+(?:_wrong)?)"/gu)].map((hit) => hit[1]!))];
    if (ids.length) out.set(String((ev as { name?: string }).name ?? ev.id), ids);
  }
  return out;
}
const shared = (ids: Map<string, string[]>): string[] => {
  const owners = new Map<string, string[]>();
  for (const [name, list] of ids) for (const id of list) owners.set(id, [...(owners.get(id) ?? []), name]);
  return [...owners].filter(([, names]) => names.length > 1).map(([id, names]) => `${id} ← ${names.join(" + ")}`);
};

describe("사슬 고리의 스위치·변수 번호는 호출 순번이 아니라 그 고리의 것", () => {
  it("같은 이름의 사슬을 두 번에 나눠 지어도 두 고리가 같은 «집어 감» 스위치·같은 번호 변수를 쓰지 않는다", () => {
    const { ctx, build } = start();
    expect(build([
      { role: "pickup", name: "나디아", person: "마을 사람", at: { x: 3, y: 3 }, lines: ["샘지기를 찾아가 보렴."], reward: { flag: "나디아의 부탁" } },
      { role: "code", name: "낡은 궤", at: { x: 5, y: 3 }, code: "4826", needs: "나디아의 부탁", lines: ["번호 자물쇠다."], hintAfter: 2, hintLines: ["(일지를 다시 보자.)"], reward: { flag: "궤 열림" } },
    ]).ok).toBe(true);
    expect(build([
      { role: "pickup", name: "샘지기 아말", person: "마을 사람", at: { x: 3, y: 6 }, lines: ["길을 열어 주마."], reward: { flag: "샘지기의 허락" } },
      { role: "code", name: "돌문 자물쇠", at: { x: 5, y: 6 }, code: "7315", needs: "샘지기의 허락", lines: ["번호 자물쇠다."], hintAfter: 2, hintLines: ["(샘지기의 말을 떠올리자.)"], reward: { flag: "돌문 열림" } },
    ]).ok).toBe(true);
    const ids = perLinkIds(ctx.project);
    expect([...ids.keys()].sort()).toEqual(["나디아", "낡은 궤", "돌문 자물쇠", "샘지기 아말"].sort());
    expect(shared(ids)).toEqual([]);
    // 첫 호출의 번호는 그대로다(1, 2) — 처음 짓는 사슬의 결과는 바뀌지 않는다.
    expect(ids.get("나디아")!.every((id) => /_1$/u.test(id))).toBe(true);
    expect(ids.get("낡은 궤")!.every((id) => /_2(?:_wrong)?$/u.test(id))).toBe(true);
  });

  it("한 고리만 다시 지으면 그 고리가 쓰던 번호를 그대로 쓴다", () => {
    const { ctx, build } = start();
    build([
      { role: "pickup", name: "나디아", person: "마을 사람", at: { x: 3, y: 3 }, lines: ["샘지기를 찾아가 보렴."], reward: { flag: "나디아의 부탁" } },
      { role: "pickup", name: "자히르", person: "상인", at: { x: 5, y: 3 }, lines: ["찻집으로 가 봐."], needs: "나디아의 부탁", reward: { flag: "상인의 단서" } },
    ]);
    build([{ role: "pickup", name: "샘지기 아말", person: "마을 사람", at: { x: 3, y: 6 }, lines: ["길을 열어 주마."], reward: { flag: "샘지기의 허락" } }]);
    const before = perLinkIds(ctx.project).get("샘지기 아말");
    expect(build([{ role: "pickup", name: "샘지기 아말", lines: ["길을 열어 주마. 조심하렴."], reward: { flag: "샘지기의 허락" } }]).ok).toBe(true);
    const after = perLinkIds(ctx.project);
    expect(after.get("샘지기 아말")).toEqual(before);
    expect(shared(after)).toEqual([]);
  });
});

describe("act-depth-min: 청사진 경로가 이미 길고 이어져 있으면 «다시 써라» 를 올리지 않는다", () => {
  const task = "사막 오아시스 모험 게임 하나 만들어 줘.";
  const names = ["나디아", "자히르", "라일라", "파리드", "사미라", "모래의 파수꾼", "잠든 왕의 수호자"];
  const gives = ["샘의 부탁", "상인의 단서", "라일라의 약속", "대상의 신뢰", "왕실의 진실", "열린 피라미드", "달샘의 귀환"];
  function game(steps: number, itemAt: number): Project {
    const { ctx, build } = start();
    const used = names.slice(0, steps);
    const built = build(used.map((name, i): ChainLink => ({
      role: i === steps - 1 ? "ending" : "pickup", name, person: "마을 사람", at: { x: 2 + i * 2, y: 4 }, lines: [`${name}의 말.`],
      ...(i ? { needs: gives[i - 1]! } : {}), ...(i === steps - 1 ? {} : { reward: i === itemAt ? { item: gives[i]! } : { flag: gives[i]! } }),
    })));
    expect(built.ok).toBe(true);
    const project = ctx.project;
    const place = project.maps[project.startMapId]!.name || project.startMapId;
    project.gameBlueprint = normalizeGameBlueprint({
      title: CHAIN, genre: "모험", playerGoal: "샘을 되살리자.", ending: { name: CHAIN, how: "물이 돌아왔다.", feeling: "안도" },
      steps: used.map((name, i) => ({ id: `s${i + 1}`, kind: "talk", who: name, place, event: name, action: `${name}에게 말을 건다`, ...(i ? { needs: gives[i - 1] } : {}), gives: gives[i], feeling: "설렘" })),
    });
    return project;
  }

  it("7단계 경로(가운데 한 단계가 물건을 준다)를 다 지은 판: 깊이는 모자라게 재어져도 관문은 서지 않는다", () => {
    const project = game(7, 2);
    expect(walkBlueprint(project).blockers).toEqual([]);
    expect(progressionDepth(project)).toBeLessThan(MIN_ACT_DEPTH);
    expect(actDepthMinBlocker(project, task)).toEqual([]);
  });

  it("청사진이 짧으면(4단계) 종전대로 선다", () => {
    const project = game(4, -1);
    expect(actDepthMinBlocker(project, task).map((b) => b.id)).toEqual(["act-depth-min"]);
  });

  it("청사진은 길어도 경로가 끊겨 있으면(단계 이벤트가 없다) 종전대로 선다", () => {
    const project = game(7, -1);
    const map = project.maps[project.startMapId]!;
    map.events = map.events.filter((ev) => (ev as { name?: string }).name !== "파리드");
    expect(walkBlueprint(project).blockers.length).toBeGreaterThan(0);
    expect(actDepthMinBlocker(project, task).map((b) => b.id)).toEqual(["act-depth-min"]);
  });
});

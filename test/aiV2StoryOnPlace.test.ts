import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { isEntranceArt } from "@/ai/v2/place/entrances";
import { drawnThings, onDrawnThing, thingMatch } from "@/ai/v2/place/fixtures";
import { incomingLandings } from "@/ai/v2/place/where";
import { isDoorEvent } from "@/ai/v2/judge/eventReach";
import { finishStepOnBossVictoryIn } from "@/ai/v2/story/blueprintPathBattles";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import type { ToolContext } from "@/editor/tools/types";
import type { GameEvent, GameMap, Project } from "@/project/types";

// 2026-11-12 r1s-fun 「증기의 심장」(Sonnet 이 «재밌는 게임 만들어 줘.» 로 지은 게임, steampunk_city):
//  (1) 단계가 쓰게 하는 물건이 그 장소의 그림과 따로 놀았다 — 「압력 밸브」는 벽의 밸브 바퀴를 두고 나무 상자에, 「대심장 정지 레버」는 맨바닥 반짝임(발밑)에.
//  (2) 번호를 맞혀도 winLines 가 안 나왔고, 보스를 이기면 마지막 단계(레버)가 저절로 돌아 엔딩이 났다.
//  (3) 방→방 문이 벽 곁 맨바닥 한 칸이었고, 바깥 맵의 돌아가는 칸이 열린 길 한가운데였다.
// 재는 법(모델 없음): scripts/qa/assistant-v2/storyOnPlaceProbe.mts. 문서 openwiki/assistant-v2.md 「이야기의 물건은 그 장소의 그림이다」.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).

describe("이름이 그림을 가리키는 세기(thingMatch)", () => {
  const valve = { label: "벽 밸브 바퀴", kitName: "벽 밸브 바퀴", tags: ["밸브"] };
  const terminal = { label: "천공 카드 단말기", kitName: "천공 카드 단말기(놋쇠 건반·레버·다이얼 조작대)", tags: ["단말기", "조작대"] };
  it("물건 낱말(마지막 어절)이 이름표의 낱말이면 맞는 그림이다", () => {
    expect(thingMatch("압력 밸브", valve)).toBe(2);
    expect(thingMatch("벽 밸브 바퀴", valve)).toBe(3);
    expect(thingMatch("번호 쪽지", { label: "바닥의 쪽지", tags: ["쪽지", "종이", "단서"] })).toBe(2);
  });
  it("낱말이 키트 이름의 괄호 속 부품 설명에만 있으면 약하게 맞는다", () => {
    expect(thingMatch("대심장 정지 레버", terminal)).toBe(1);
  });
  it("조사(find) 단계가 세운 이벤트는 이름에 「문」이 있어도 문이 아니다 — 단계의 종류가 말한다(낱말 표에 낱말을 더하지 않는다)", () => {
    const project = createBlankProject();
    const ev = { id: "ev_chain_x_4", name: "태양의 비문", x: 1, y: 1, pages: [] } as unknown as GameEvent;
    // 청사진 밖의 이벤트는 전처럼 이름으로 읽는다.
    expect(isDoorEvent(project, ev)).toBe(true);
    // 사슬을 짓는 중(아직 청사진에 적히기 전)에는 부르는 쪽이 조사 단계의 id 를 넘긴다.
    expect(isDoorEvent(project, ev, new Set([ev.id]))).toBe(false);
    // 지은 뒤에는 청사진 단계의 종류로.
    project.gameBlueprint = { title: "t", genre: "g", playerGoal: "p", steps: [{ id: "s4", kind: "find", place: "p", event: "태양의 비문", action: "a", gives: "g", feeling: "f", built: { mapId: project.startMapId, eventId: ev.id } }], ending: { name: "e", how: "h", feeling: "f" } } as unknown as Project["gameBlueprint"];
    expect(isDoorEvent(project, ev)).toBe(false);
    // 번호 자물쇠가 달린 문(puzzle 단계)은 전처럼 문이다.
    project.gameBlueprint!.steps[0]!.kind = "puzzle";
    expect(isDoorEvent(project, { ...ev, name: "굳게 닫힌 철문" } as GameEvent)).toBe(true);
  });
  it("낱말이 없으면 아니다 — 글자 포함으로 읽지 않는다", () => {
    expect(thingMatch("감시탑 일지", valve)).toBe(0);
    expect(thingMatch("책", { label: "목책 말뚝", tags: [] })).toBe(0);
  });
});

describe("증기 도시 한 판 — 물건은 그림에, 단계는 차례로, 문은 그려진 자리에", () => {
  function harness() {
    const project = createBlankProject();
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const env: PiAssistantV2Env = {
      ctx, request: { task: "스팀펑크 증기 도시에서 벌어지는 게임 하나 만들어 줘.", provider: "local-cli:claude", mapIds: [], project, projectKey: '["project","story-on-place"]' } as never,
      emit: () => {}, record: () => {},
      sideChat: async () => JSON.stringify({ imagesSeen: 0, axes: {}, score: 7, majors: [] }),
      render: async () => "", checkpoint: async () => {},
    };
    const tools = createV2Tools(env, new V2Session());
    const call = async (name: string, args: unknown): Promise<{ ok?: boolean; summary?: string }> => {
      const res = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args);
      return JSON.parse((res.content as { type: string; text?: string }[]).find((c) => c.type === "text")!.text!.split("\n[청사진 진행]")[0]!) as { ok?: boolean; summary?: string };
    };
    return { ctx, call };
  }
  const places = [
    { name: "황동 광장", kind: "street" }, { name: "운하 부두", kind: "dock", from: "황동 광장" }, { name: "굴뚝 공업지구", kind: "industrial", from: "운하 부두" },
    { name: "오르텐의 공방", kind: "workshop", from: "황동 광장" }, { name: "지하 보일러실", kind: "boiler-room", from: "굴뚝 공업지구" }, { name: "대심장 기관실", kind: "engine-room", from: "지하 보일러실" },
  ];
  const blueprint = {
    title: "증기의 심장", genre: "모험", setting: "steampunk_city", playerGoal: "폭주하는 대심장을 멈추자.", places,
    ending: { name: "멈춘 심장", how: "레버를 당긴다.", feeling: "안도", closing: ["대심장이 멈췄다."] },
    steps: [
      { id: "s1", kind: "talk", who: "신문팔이 핀", place: "황동 광장", event: "신문팔이 핀", action: "핀에게 소문을 듣는다", gives: "공방 소개", feeling: "호기심" },
      { id: "s2", kind: "talk", who: "오르텐 할멈", place: "오르텐의 공방", event: "오르텐 할멈", action: "오르텐에게 렌치를 받는다", needs: "공방 소개", gives: "item:황동 렌치", feeling: "신뢰" },
      { id: "s3", kind: "choice", who: "선장 바르가", place: "운하 부두", event: "선장 바르가", action: "선장에게 통행증을 받는다", needs: "item:황동 렌치", gives: "공업지구 통행증", feeling: "갈등" },
      { id: "s4", kind: "find", place: "굴뚝 공업지구", event: "감시탑 일지", action: "일지에서 번호를 읽는다", needs: "공업지구 통행증", gives: "압력 밸브 번호 단서", feeling: "긴장" },
      { id: "s5", kind: "puzzle", place: "지하 보일러실", event: "압력 밸브", action: "밸브의 번호를 맞춘다", needs: "압력 밸브 번호 단서", gives: "기관실 개방", feeling: "성취" },
      { id: "s6", kind: "battle", who: "폭주 자동인형", place: "대심장 기관실", event: "폭주 자동인형", action: "자동인형과 싸워 이긴다", needs: "기관실 개방", gives: "자동인형 정지", feeling: "위기" },
      { id: "s7", kind: "find", place: "대심장 기관실", event: "대심장 정지 레버", action: "레버를 당겨 대심장을 멈춘다", needs: "자동인형 정지", gives: "ending", feeling: "안도" },
    ],
  };
  const text = [
    { id: "s1", lines: ["대심장이 사흘째 울어 대고 있어. 오르텐 할멈을 찾아가 봐."] },
    { id: "s2", lines: ["이건 황동 렌치란다. 가져가거라."] },
    { id: "s3", lines: ["어느 쪽이냐?"], choices: [{ text: "노동자 편", lines: ["수로 통행증이다."], later: "노동자들이 당신 이름을 불렀다." }, { text: "공장주 편", lines: ["정식 통행증이다."], later: "공장은 질서를 되찾았다." }] },
    { id: "s4", lines: ["'보일러실 압력 밸브 잠금 번호는 4729.'"] },
    { id: "s5", code: "4729", lines: ["거대한 압력 밸브다."], lockedLines: ["번호를 알아야 한다."], winLines: ["철컥! 밸브가 풀리고 증기가 빠져나간다."], wrongLines: ["번호가 틀린 모양이다."] },
    { id: "s6", lines: ["침입자 배제."], winLines: ["(자동인형이 멈춰 섰다.)"] },
    { id: "s7", lines: ["황동 렌치를 레버에 끼우고 힘껏 돌렸다."] },
  ];
  const SLOW = 300_000;
  const json = (value: unknown): string => JSON.stringify(value);
  const mapOf = (project: Project, name: string): GameMap => Object.values(project.maps).find((m) => m.name === name)!;
  const stepEvent = (project: Project, id: string): { map: GameMap; ev: GameEvent } => {
    const built = project.gameBlueprint!.steps.find((st) => st.id === id)!.built!;
    const map = project.maps[built.mapId]!;
    return { map, ev: map.events.find((e) => e.id === built.eventId)! };
  };

  it("조사·퍼즐 단계의 물건은 그려진 물건 칸에 앉고, 번호를 맞히면 winLines 가 나오고, 보스 승리는 마지막 단계를 부르지 않는다", async () => {
    const { ctx, call } = harness();
    for (let i = 0; i < 4 && !ctx.project.gameBlueprint; i += 1) await call("write_blueprint", blueprint);
    expect(ctx.project.gameBlueprint?.setting).toBe("steampunk_city");
    const built = await call("build_places", {});
    expect(built.ok).toBe(true);
    // 조사·퍼즐 단계가 있는 장소의 그려진 물건 이름을 모델에게 보인다.
    expect(built.summary).toContain("Things drawn where a find/puzzle step happens");
    expect(built.summary).toContain("벽 밸브 바퀴");
    let path = await call("build_blueprint_path", { steps: text });
    if (path.ok === false) path = await call("build_blueprint_path", { steps: text });
    expect(path.ok).toBe(true);
    const project = ctx.project;

    // (1) 물건 — 「압력 밸브」는 밸브 그림에, 「대심장 정지 레버」는 그려진 물건에(맨바닥·발밑·반짝임이 아니다).
    for (const id of ["s4", "s5", "s7"]) {
      const { map, ev } = stepEvent(project, id);
      const under = onDrawnThing(project, map, ev);
      expect(under, `${id} ${ev.name} (${ev.x},${ev.y}) 는 그려진 물건 위`).toBeTruthy();
      expect((ev.pages ?? []).every((p) => (p.priority ?? "same") === "same"), `${id} 는 마주 보고 누른다`).toBe(true);
      // 이름이 맞는 그림에 앉은 단계는 반짝이지도 빛나지도 않는다 — 그림이 곧 그 물건이다.
      // 맞는 그림이 없어 가까운 물건에 앉은 단계(s4 「감시탑 일지」)는 그 물건이 늘 빛난다 — 그림만 봐서는 그 물건인 줄 모른다(정직한 플레이와 같은 눈: project/eventSight).
      const lit = (ev.pages ?? []).some((p) => !!(p as { glow?: unknown }).glow);
      if (id === "s4") expect(lit || thingMatch(ev.name ?? "", under!) > 0, "s4 는 이름이 다른 그림 위에서 빛난다").toBe(true);
      else {
        expect((ev.pages ?? []).some((p) => !!(p as { nearSparkle?: unknown }).nearSparkle), `${id} 에 반짝임이 없다`).toBe(false);
        expect(lit, `${id} 는 늘 빛나는 표지가 아니다`).toBe(false);
      }
      const stand = [[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => isPassable(project, map, ev.x + dx!, ev.y + dy!));
      expect(stand, `${id} 곁에 설 칸이 있다`).toBe(true);
    }
    const valve = stepEvent(project, "s5");
    expect(thingMatch("압력 밸브", onDrawnThing(project, valve.map, valve.ev)!)).toBeGreaterThanOrEqual(2);
    expect(thingMatch("대심장 정지 레버", onDrawnThing(project, stepEvent(project, "s7").map, stepEvent(project, "s7").ev)!)).toBeGreaterThanOrEqual(1);

    // (2) 단계 — 번호를 맞힌 갈래에 winLines, 보스(s6)는 s7 을 부르지 않고 엔딩은 s7 이 부른다.
    expect(json(valve.ev.pages)).toContain("철컥! 밸브가 풀리고 증기가 빠져나간다.");
    finishStepOnBossVictoryIn(project);
    const boss = stepEvent(project, "s6").ev, lever = stepEvent(project, "s7").ev;
    expect(json(boss.pages)).not.toContain(`"kind":"callMapEvent","eventId":"${lever.id}"`);
    expect(json(boss.pages)).not.toContain('"triggerEnding"');
    expect(json(lever.pages)).toMatch(/"kind":"(?:triggerEnding|ending)"/u);

    // (3) 문 — 다른 맵으로 가는 칸은 맵 가장자리이거나 문·계단 그림(그 칸 또는 바로 위)이고, 문 앞 칸이 열려 있다.
    for (const map of Object.values(project.maps)) for (const ev of map.events) {
      if (!/"kind":"transfer"/u.test(json(ev.pages)) || json(ev.pages).includes(`"mapId":"${map.id}"`)) continue;
      const edge = ev.x === 0 || ev.y === 0 || ev.x === map.width - 1 || ev.y === map.height - 1;
      const art = isEntranceArt(project, map, ev.x, ev.y) || isEntranceArt(project, map, ev.x, ev.y - 1);
      expect(edge || art, `${map.name} (${ev.x},${ev.y}) 이동 칸은 가장자리이거나 문·계단 그림`).toBe(true);
      const front = [[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => isPassable(project, map, ev.x + dx!, ev.y + dy!) && !map.events.some((o) => o.id !== ev.id && o.x === ev.x + dx! && o.y === ev.y + dy! && /"kind":"transfer"/u.test(json(o.pages))));
      expect(front, `${map.name} (${ev.x},${ev.y}) 문 앞이 열려 있다`).toBe(true);
    }
    // 방에서 방으로(보일러실 → 기관실)는 계단 그림이다.
    const boiler = mapOf(project, "지하 보일러실"), engine = mapOf(project, "대심장 기관실");
    const toEngine = boiler.events.filter((e) => json(e.pages).includes(`"mapId":"${engine.id}"`));
    expect(toEngine.length).toBeGreaterThanOrEqual(1);
    expect(toEngine.every((e) => isEntranceArt(project, boiler, e.x, e.y))).toBe(true);
    // 적·상자는 어느 도착 칸에서든 다섯 걸음 밖이다 — 문을 길 끝으로 옮긴 뒤 옛 «들어서는 칸» 기준으로 놓인 적이 도착 칸 세 칸 곁에 섰다.
    for (const map of Object.values(project.maps)) for (const ev of map.events.filter((e) => /_wfoe\d+$|_wchest$/u.test(e.id))) {
      for (const land of incomingLandings(project, map.id)) expect(Math.abs(land.x - ev.x) + Math.abs(land.y - ev.y), `${map.name} ${ev.id} 는 도착 칸 (${land.x},${land.y}) 에서 떨어져 있다`).toBeGreaterThan(5);
    }
    // 그 장소에 그려진 물건을 읽는다 — 보일러실에는 밸브 바퀴가 있다.
    expect(drawnThings(project, boiler).some((t) => t.label.includes("밸브"))).toBe(true);
  }, SLOW);

  it("모델이 고른 그림(steps[].on)이 먼저다", async () => {
    const { ctx, call } = harness();
    for (let i = 0; i < 4 && !ctx.project.gameBlueprint; i += 1) await call("write_blueprint", blueprint);
    expect((await call("build_places", {})).ok).toBe(true);
    const picked = text.map((t) => (t.id === "s5" ? { ...t, on: "벽 압력계 묶음" } : t));
    let path = await call("build_blueprint_path", { steps: picked });
    if (path.ok === false) path = await call("build_blueprint_path", { steps: picked });
    expect(path.ok).toBe(true);
    const { map, ev } = stepEvent(ctx.project, "s5");
    expect(onDrawnThing(ctx.project, map, ev)?.label).toContain("압력계");
  }, SLOW);
});

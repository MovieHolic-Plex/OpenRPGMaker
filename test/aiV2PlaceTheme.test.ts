import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { applyThemeBackdrop, placeThemeOf, themeBossTroop, themeFieldTroops, usableLoot } from "@/ai/v2/place/placeTheme";
import { artGapLine, parseArtGap } from "@/project/artGap";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import type { ToolContext } from "@/editor/tools/types";
import type { Project } from "@/project/types";

// 2026-11-11 눈가림 플레이(fun-x1-gatefix · fun-w3): 사막 피라미드의 전투 배경이 숲이고 적이 «광산 해골 궁수», 상자가 «슬라임 젤리»였다.
// 이긴 보스가 맵에 그대로 서 있었고, 서 있던 붉은 드래곤이 전투에서는 황토색 드래곤이었다.
// 재는 법(모델 없음): scripts/qa/assistant-v2/storyCoherenceProbe.mts. 문서 openwiki/assistant-v2.md 「맵 위의 적·전투 배경·상자는 그 장소의 테마에서」.

const SLOW = 120_000;
const task = "밤의 학교를 탐험하는 게임 하나 만들어 줘.";

function harness() {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const env: PiAssistantV2Env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {} };
  const tools = createV2Tools(env, new V2Session());
  const call = async (name: string, args: unknown): Promise<{ ok?: boolean; summary?: string }> => {
    const res = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args);
    const text = (res.content as { type: string; text?: string }[]).find((c) => c.type === "text")!.text!;
    try { return JSON.parse(text.split("\n[")[0]!) as { ok?: boolean; summary?: string }; } catch { return { ok: false, summary: text }; }
  };
  const eventOf = (name: string) => Object.values(ctx.project.maps).flatMap((m) => m.events).find((e) => e.name === name);
  return { ctx, call, eventOf };
}

const SPOTS = ["현관", "복도", "교실", "도서실", "옥상 계단", "옥상"];
const blueprint = {
  title: "밤의 학교", genre: "모험", playerGoal: "밤의 학교에서 단서를 따라 옥상까지 가자.", ending: { name: "새벽", how: "해가 뜨고 문이 열렸다.", feeling: "안도" },
  steps: [
    { id: "s1", kind: "talk", who: "촌장 하르", place: SPOTS[0], event: "촌장 하르", action: "촌장에게 사정을 듣는다", gives: "촌장의 부탁", feeling: "걱정" },
    { id: "s2", kind: "find", place: SPOTS[1], event: "낡은 일지", action: "일지를 읽는다", needs: "촌장의 부탁", gives: "일지의 기록", feeling: "호기심" },
    { id: "s3", kind: "choice", who: "떠돌이 상인 미라", place: SPOTS[2], event: "떠돌이 상인 미라", action: "상인에게서 고른다", needs: "일지의 기록", gives: "상인의 물건", feeling: "설렘" },
    { id: "s4", kind: "battle", who: "얼음 문지기", place: SPOTS[3], event: "얼음 문지기", action: "문지기를 이긴다", needs: "상인의 물건", gives: "문지기 격파", feeling: "긴장" },
    { id: "s5", kind: "puzzle", place: SPOTS[4], event: "별의 봉인", action: "기록의 숫자로 봉인을 연다", needs: "문지기 격파", gives: "봉인 해제", feeling: "발견" },
    { id: "s6", kind: "talk", who: "별의 정령", place: SPOTS[5], event: "별의 정령", action: "정령에게 소원을 빈다", needs: "봉인 해제", gives: "엔딩", feeling: "안도" },
  ],
};
/** 번호를 두 단계 앞(일지)에서 알려 주는 판과 어디서도 알려 주지 않는 판. */
const stepText = (told: boolean) => [
  { id: "s1", lines: ["어서 오게. 밤마다 종이 저절로 울린다네."] },
  { id: "s2", lines: told ? ["(낡은 일지에 적혀 있다. 봉인을 여는 숫자는 4826.)"] : ["(낡은 일지에는 종탑 이야기가 적혀 있다.)"] },
  { id: "s3", lines: ["뭘로 하시겠어요?"], choices: [{ text: "등불을 산다", lines: ["밤길엔 등불이죠."], later: "등불이 길을 밝혔다." }, { text: "지도를 산다", lines: ["길을 잃진 않겠네요."], later: "지도 덕에 지름길로 왔다." }] },
  { id: "s4", lines: ["여기부터는 못 지나간다."], winLines: ["(문지기가 얼음 속으로 물러난다.)"], doneLines: ["(얼음 조각만 남아 있다.)"] },
  { id: "s5", lines: ["(별 모양 홈에 숫자를 맞추자.)"], lockedLines: ["(문지기의 시험을 먼저 통과해야 한다.)"], ...(told ? { code: "4826" } : {}) },
  { id: "s6", lines: ["네 소원을 들려다오."] },
];

describe("싸우는 단계의 상대", () => {
  it("전투 그림으로 서고, 이기면 맵에서 걷힌다", async () => {
    const { ctx, call, eventOf } = harness();
    if (!(await call("write_blueprint", blueprint)).ok) expect((await call("write_blueprint", blueprint)).ok).toBe(true);
    expect((await call("build_blueprint_path", { steps: stepText(true) })).ok).toBe(true);
    const foe = eventOf("얼음 문지기")!;
    const fight = (foe.pages ?? []).find((page) => (page.commands ?? []).some((c) => c.kind === "battleProcessing"))!;
    const troopId = ((fight.commands ?? []).find((c) => c.kind === "battleProcessing") as unknown as { troopId: string }).troopId;
    const troop = ctx.project.database.troops.find((t) => t.id === troopId)!;
    const lead = ctx.project.database.enemies.find((e) => e.id === troop.enemyIds[0])!;
    expect((fight.graphic as { sprite?: { id?: string } }).sprite?.id).toBe(lead.monsterResourceId);
    const after = foe.pages!.at(-1)!;
    expect(after.conditions?.length).toBe(1);
    expect(after.graphic).toEqual({ transparent: true });
    expect(after.priority).toBe("below");
    expect(after.commands).toEqual([]);
  }, SLOW);
});

describe("장소의 테마 — 적 · 전투 배경 · 상자", () => {
  function desert(): { project: Project; mapId: string } {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    map.tilesetId = "desert_east";
    map.name = "잠든 피라미드";
    project.gameBlueprint = normalizeGameBlueprint({ title: "t", genre: "모험", setting: "desert_east", playerGoal: "g", ending: { name: "끝", how: "끝", feeling: "f" },
      places: [{ name: "잠든 피라미드", kind: "pyramid" }, { name: "묘실", kind: "tomb" }],
      steps: [{ id: "s1", place: map.name, event: "x", action: "a", gives: "가", feeling: "f" }, { id: "s2", place: map.name, event: "y", action: "b", needs: "가", gives: "엔딩", feeling: "f" }] });
    return { project, mapId: map.id };
  }

  it("사막 유적의 길 적·보스·배경은 사막의 것이다(시작 파티에 맞춘 사본)", () => {
    const { project, mapId } = desert();
    expect(placeThemeOf(project, mapId)?.id).toBe("desert_east/pyramid");
    const field = themeFieldTroops(project, mapId);
    expect(field.gap).toBeUndefined();
    expect(field.troopIds.map((id) => project.database.troops.find((t) => t.id === id)?.name)).toEqual(["모래 전갈", "모래 지렁이", "독사", "뿔 딱정벌레"]);
    expect(field.troopIds.every((id) => id.startsWith("troop_fit_field_"))).toBe(true);
    const boss = themeBossTroop(project, mapId, "모래 수호자", true, 0);
    expect(project.database.troops.find((t) => t.id === boss.troopId)?.name).toBe("점토 골렘");
    expect(applyThemeBackdrop(project, mapId).gap).toBeUndefined();
    expect(project.maps[mapId]!.battleBackground).toBe("battle-scenery-desert");
    // 저작한 배경은 그대로 둔다(기본값 숲만 저작으로 치지 않는다).
    project.maps[mapId]!.battleBackground = "battle-scenery-plains";
    expect(applyThemeBackdrop(project, mapId)).toEqual({});
  });

  it("맞는 그림이 없으면 대역을 쓰고 없는 그림 줄을 남긴다 — 줄은 다시 읽힌다", () => {
    const { project, mapId } = desert();
    project.maps[mapId]!.name = "묘실";
    const res = applyThemeBackdrop(project, mapId);
    expect(project.maps[mapId]!.battleBackground).toBe("battle-scenery-cave");
    expect(parseArtGap(res.gap!)).toEqual({ theme: "desert_east/tomb", want: "backdrop", wanted: "stone burial chamber", where: "묘실", standIn: "battle-scenery-cave" });
    const gap = { theme: "sf_station/*", want: "foe", wanted: "security robots, drones, aliens", where: "정거장", standIn: "금속 슬라임" } as const;
    expect(parseArtGap(artGapLine(gap))).toEqual(gap);
    // 테마 표에 없는 세계(버들항)의 맵은 종전 길로 간다.
    const plain = createBlankProject() as Project;
    expect(placeThemeOf(plain, plain.startMapId)).toBeUndefined();
    expect(themeFieldTroops(plain, plain.startMapId).troopIds).toEqual([]);
  });

  it("상자 보상은 전투에서 쓰는 회복약이나 돈이다 — 제작 재료는 주지 않는다", () => {
    const project = createBlankProject() as Project;
    for (let salt = 0; salt < 40; salt += 1) {
      const loot = usableLoot(project, salt);
      if (!loot.itemId) { expect(loot.gold).toBeGreaterThanOrEqual(150); continue; }
      expect(project.database.items.find((item) => item.id === loot.itemId)?.type).toBe("medicine");
    }
  });
});

// 2026-11-13 r2s-fun(증기 도시) · r2t-fun(설원) 두 판을 타이틀에서 엔딩까지 해 보고 찾은 일곱 결함의 고친 자리.
// 명세는 harness-data/assistant-capability/spec-bank/r2s-fun.json · r2t-fun.json 에 있고(명세 은행이 통째로 다시 짓는다), 여기서는 고친 규칙만 작은 값으로 본다.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { STEAMPUNK_CITY_ID } from "@/project/defaults/steampunkCity";
import { isPassable } from "@/project/collision";
import { runTool } from "@/editor/tools";
import type { Project } from "@/project/types";
import { buildingEntrances } from "@/ai/v2/place/entrances";
import { afterWinLines } from "@/ai/v2/story/playerLines";
import { stepHandover } from "@/ai/v2/story/stepHandover";
import { fitPathBattlesIn, pathBattles } from "@/ai/v2/story/pathBattleBudget";
import { fitTroopCopy } from "@/editor/tools/bossThreatScaling";
import { simulateBattle } from "@/battle/simulate";
import { BOSS_BAND } from "@/ai/v2/story/pathBattleTension";

describe("소지품에 드는 것은 단계의 종류와 화면 글이 정한다", () => {
  const at = { last: false, leaves: false } as const;
  it("사람·자물쇠의 단계는 그 글이 물건을 부를 때만 건넨다 — 진행 이름(「얼음문 열림」「촌장의 부탁」)은 소지품이 아니다", () => {
    expect(stepHandover({ kind: "puzzle", gives: "얼음문 열림" }, { id: "s5", item: "얼음문 열림", lines: ["얼음문에 네 자리 숫자를 새길 홈이 있다."], winLines: ["얼음문이 쩌억 소리를 내며 열렸다."] }, at)).toEqual({});
    expect(stepHandover({ kind: "talk", gives: "촌장의 부탁" }, { id: "s1", item: "촌장의 부탁", lines: ["긴집의 화덕이 소리도 없이 꺼졌다네.", "먼저 가서 들어보게."] }, at)).toEqual({});
    expect(stepHandover({ kind: "choice", gives: "얼음 스파이크" }, { id: "s3", item: "얼음 스파이크", lines: ["얼음 스파이크? 있지, 있고말고."] }, at)).toEqual({ item: "얼음 스파이크" });
    expect(stepHandover({ kind: "battle", gives: "되찾은 불씨" }, { id: "s6", item: "되찾은 불씨", lines: ["이 불씨는 이제 내 것이다."], winLines: ["따스하게 빛나는 불씨가 떨어졌다."] }, { ...at, leaves: true })).toEqual({ item: "되찾은 불씨" });
  });

  it("줍는 단계는 적힌 물건 그대로, 마지막 단계는 건네지 않는다", () => {
    expect(stepHandover({ kind: "find", gives: "황동 압력 밸브" }, { id: "s3", item: "황동 압력 밸브", lines: ["기름 먹인 천에 싸인 것이 반짝였다."] }, at)).toEqual({ item: "황동 압력 밸브" });
    expect(stepHandover({ kind: "talk", gives: "마을의 겨울 구원" }, { id: "s7", item: "불씨", lines: ["불씨! 정말 해냈구나!"] }, { ...at, last: true })).toEqual({});
  });

  it("뒤 자물쇠의 번호를 알려 주는 단계: 맵에 남는 것은 스위치, 쓰러져 사라지는 상대는 그 글을 실은 쪽지", () => {
    const journal = { id: "s4", item: "일지의 숫자", lines: ["낡은 일지다.", "'얼음문의 숫자는 7342.'"] };
    expect(stepHandover({ kind: "find", gives: "일지의 숫자" }, journal, { ...at, told: "7342" })).toEqual({});
    const doll = { id: "s5", lines: ["증기 인형이 일어선다."], winLines: ["가슴 속에서 구겨진 쪽지가 떨어졌다.", "'기관실 다이얼 번호: 7302.'"] };
    expect(stepHandover({ kind: "battle", gives: "기관실 암호 쪽지" }, doll, { ...at, told: "7302", leaves: true })).toEqual({ item: "기관실 암호 쪽지", note: "'기관실 다이얼 번호: 7302.'" });
    // 글이 물건을 부르지 않으면 함수의 쪽지.
    const boss = { id: "s5", lines: ["덤벼라."], winLines: ["(숨이 끊어지며) 번호는 7302다…"] };
    expect(stepHandover({ kind: "battle", gives: "기관실 개방" }, boss, { ...at, told: "7302", leaves: true })).toEqual({ item: "번호 쪽지", line: "번호를 쪽지에 적어 두었다.", note: "(숨이 끊어지며) 번호는 7302다…" });
  });

  it("종류를 적지 않은 옛 청사진은 전과 같다 — item, 없으면 gives 의 물건 낱말", () => {
    expect(stepHandover({ gives: "낡은 열쇠" }, undefined, at)).toEqual({ item: "낡은 열쇠" });
    expect(stepHandover({ gives: "비밀번호 단서" }, undefined, at)).toEqual({});
  });
});

describe("이긴 뒤의 글은 서술이 기본이다", () => {
  it("따옴표·낫표로 감싼 줄만 그 상대의 말(이름표), 나머지는 서술 — 작은따옴표는 인용한 글", () => {
    expect(afterWinLines(["정령이 흩어지며 불씨가 떨어졌다.", "\"이럴 수가…\"", "「다음에 보자」", "'기관실 다이얼 번호: 7302'", "(연기가 걷힌다.)", " "], "서리 정령")).toEqual([
      { kind: "text", body: "정령이 흩어지며 불씨가 떨어졌다." },
      { kind: "text", speaker: "서리 정령", body: "이럴 수가…" },
      { kind: "text", speaker: "서리 정령", body: "다음에 보자" },
      { kind: "text", body: "'기관실 다이얼 번호: 7302'" },
      { kind: "text", body: "(연기가 걷힌다.)" },
    ]);
    expect(afterWinLines(["\"졌다.\""], undefined)).toEqual([{ kind: "text", body: "\"졌다.\"" }]);
  });
});

describe("스팀펑크 건물 줄의 뒤로 걸어 들어가지 못한다", () => {
  it("거리·부두·공장 지대: 시작 칸에서 걸어 닿는 칸 가운데 북쪽 건물 줄의 지붕 뒤 칸이 없다", () => {
    for (const [style, width, height] of [["street", 48, 34], ["dock", 48, 34], ["industrial", 52, 40]] as const) for (const seed of [1, 2, 3]) {
      const ctx = { project: createBlankProject() as Project, currentMapId: "sp", assistantRun: true };
      expect(runTool(ctx, "create_map", { id: "sp", name: "거리", width, height, tilesetId: STEAMPUNK_CITY_ID }).ok).toBe(true);
      const built = runTool(ctx, "compose_steampunk_city_map", { mapId: "sp", style, seed });
      expect(built.ok).toBe(true);
      const map = ctx.project.maps.sp!;
      const pass = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && isPassable(ctx.project, map, x, y);
      // 맨 아래 줄의 걷는 칸에서 번져 나간다.
      const seen = new Set<number>(), queue: number[] = [];
      for (let x = 0; x < map.width; x += 1) if (pass(x, map.height - 1)) { seen.add((map.height - 1) * map.width + x); queue.push((map.height - 1) * map.width + x); }
      while (queue.length) {
        const k = queue.pop()!, x = k % map.width, y = (k - x) / map.width;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const n = (y + dy) * map.width + x + dx; if (pass(x + dx, y + dy) && !seen.has(n)) { seen.add(n); queue.push(n); } }
      }
      expect(seen.size).toBeGreaterThan(100);
      // 북쪽 건물 줄 = 문이 맵 위쪽 1/3 안에 있는 건물. 문 위에서 이어진 막힌 칸(건물 몸)의 열마다 맨 윗줄 위가 지붕 뒤다.
      const behind: string[] = [];
      for (const door of buildingEntrances(ctx.project, map).filter((e) => e.y < map.height / 3)) {
        const body = new Set<number>([(door.y - 1) * map.width + door.x]), stack = [...body];
        while (stack.length && body.size < 600) {
          const k = stack.pop()!, x = k % map.width, y = (k - x) / map.width;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy, n = ny * map.width + nx; if (nx >= 0 && ny >= 0 && nx < map.width && ny <= door.y && !pass(nx, ny) && !body.has(n)) { body.add(n); stack.push(n); } }
        }
        const top = new Map<number, number>();
        for (const k of body) { const x = k % map.width, y = (k - x) / map.width; top.set(x, Math.min(top.get(x) ?? Infinity, y)); }
        for (const [x, y0] of top) for (let y = y0 - 1; y >= 0 && pass(x, y); y -= 1) if (seen.has(y * map.width + x)) behind.push(`${style}#${seed} ${x},${y}`);
      }
      expect(behind).toEqual([]);
    }
  }, 120_000);
});

describe("싸우는 단계의 상대는 모두 보스다", () => {
  it("마지막 단계가 싸움이 아니어도, 싸우는 단계가 둘이어도 — 길목이 아니라 보스로 잰다(만나는 순서로)", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    const page = (troopId: string) => ({ id: "p0", name: "p0", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "battleProcessing", troopId, canEscape: false, canLose: false }] });
    map.events = [...(map.events ?? []),
      { id: "ev_b", name: "수호자", x: 6, y: 3, trigger: { kind: "action" }, pages: [page("troop_slime")] },
      { id: "ev_a", name: "인형", x: 3, y: 3, trigger: { kind: "action" }, pages: [page("troop_slime")] },
      { id: "ev_gate", name: "문지기", x: 4, y: 5, trigger: { kind: "action" }, pages: [page("troop_slime")] }] as never;
    const place = map.name ?? map.id;
    project.gameBlueprint = { request: "게임", title: "t", genre: "g", premise: "p", playerGoal: "g", ending: { name: "끝", how: "z", feeling: "w" }, steps: [
      { id: "s1", kind: "battle", place, event: "인형", who: "인형", label: "l" },
      { id: "s2", kind: "battle", place, event: "수호자", who: "수호자", label: "l" },
      { id: "s3", kind: "talk", place, event: "촌장", who: "촌장", label: "l" }] } as never;
    const bosses = pathBattles(project).filter((b) => b.role === "boss").sort((a, b) => (a.step ?? 0) - (b.step ?? 0));
    expect(bosses.map((b) => [b.eventId, b.step])).toEqual([["ev_a", 0], ["ev_b", 1]]);
    expect(pathBattles(project).find((b) => b.eventId === "ev_gate")!.role).toBe("gate");
    expect(BOSS_BAND).toEqual({ minWin: 0.95, turns: 12, targetTurns: [6, 10], midPotions: [1, 3], finalPotions: [2, 4], attackOnlyMaxWin: 0.1, attackOnlyMaxLeft: 0.5, midAttackOnlyMinWin: 0.5, potionAt: 0.45 });
  });
});

// 2026-11-13 감독 교정: 보스 셋을 15턴·약 4~5개의 싸움으로 만들고(HP 649 → 952) 시작 약을 두 배로 준 것은 위협이 아니라 부풀리기였다.
describe("보스 밴드는 HP 와 시작 회복약을 늘리지 않는다", () => {
  it("한 대만 올리고, 약이 모자라 밴드에 못 들면 그렇게 적는다 — 다시 돌려도 그대로", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    const boss = fitTroopCopy(project, "troop_slime", "boss")!;
    const hpOf = (troopId: string) => project.database.troops.find((t) => t.id === troopId)!.enemyIds.reduce((sum, id) => sum + project.database.enemies.find((e) => e.id === id)!.stats.maxHp, 0);
    const hpBefore = hpOf(boss);
    map.events = [...(map.events ?? []),
      { id: "ev_a", name: "인형", x: 3, y: 3, trigger: { kind: "action" }, pages: [{ id: "p0", name: "p0", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "battleProcessing", troopId: boss, canEscape: false, canLose: false }] }] }] as never;
    const place = map.name ?? map.id;
    project.gameBlueprint = { request: "게임", title: "t", genre: "g", premise: "p", playerGoal: "g", ending: { name: "끝", how: "z", feeling: "w" }, steps: [
      { id: "s1", kind: "battle", place, event: "인형", who: "인형", label: "l" },
      { id: "s2", kind: "talk", place, event: "촌장", who: "촌장", label: "l" }] } as never;
    const notes = fitPathBattlesIn(project);
    const fitted = pathBattles(project).find((b) => b.role === "boss")!.troopId;
    // 싸우는 단계 하나(마지막 단계는 대화) — 길 위 전투 하나 몫의 약 하나만 들고 시작한다. 보스를 밴드에 넣으려고 더 주지 않는다.
    expect(Object.values(project.session.inventory ?? {}).reduce((sum, n) => sum + n, 0)).toBe(1);
    expect(hpOf(fitted)).toBeLessThanOrEqual(hpBefore);
    const line = notes.find((note) => note.startsWith("보스 밴드"))!;
    expect(line).toContain("보스 밴드 밖");
    expect(line).toMatch(/약 [0-9.]+개 < 2개/u);
    expect(fitPathBattlesIn(project).filter((note) => note.includes("(보스)"))).toEqual([]);
    expect(hpOf(fitted)).toBeLessThanOrEqual(hpBefore);
  }, 180_000);

  it("모의전은 깎인 HP 로 시작할 수 있다 — 쉬지 않고 온 판을 재 볼 때 쓴다(보스 밴드는 쉬고 온 풀 HP 로 잰다 — aiV2PlayFixes2)", () => {
    const project = createBlankProject() as Project;
    const ids = project.system.startActorIds!;
    const full = simulateBattle({ project, troopId: "troop_slime", heroLevel: 1, partyActorIds: ids, n: 8, seed: 11 });
    const worn = simulateBattle({ project, troopId: "troop_slime", heroLevel: 1, partyActorIds: ids, n: 8, seed: 11, startHpRatio: 0.5 });
    expect(worn.avgHpRemaining).toBeLessThan(full.avgHpRemaining - 100);
  });
});

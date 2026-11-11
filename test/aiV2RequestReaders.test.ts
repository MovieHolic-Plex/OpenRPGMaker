// 끝맺음 검사가 읽는 «바란 것»(request/readers.ts)과, 게임 하나를 잇는 «계속» 턴이 게임 하나를 짓는 턴으로 다뤄지는가(2026-11-11 B7).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import type { Project } from "@/project/types";
import type { PiAgentRequest } from "@/ai/piAgent/protocol";
import { combatProblems } from "@/ai/v2/judge/combatChecks";
import { gameContentProblems } from "@/ai/v2/judge/gameChecks";
import { vqaEnabled } from "@/ai/v2/turn/support";
import * as readers from "@/ai/v2/request/readers";
import { findingLine } from "@/ai/v2/judge/finding";

// 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
const combatLines = (...args: Parameters<typeof combatProblems>): string[] => combatProblems(...args).map(findingLine);
const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);

type TextReader = "asksChaseNotBattleMusic" | "asksWorkingShop" | "asksTimedWhereabouts" | "asksOpenField" | "namesRandomEncounters" | "asksCure" | "asksClueForLock"
  | "asksAfterStep" | "asksShownFlashback" | "asksActEnd" | "asksLetterbox" | "saysNewGame" | "asksOpening" | "asksComboSkill" | "asksPerDay" | "asksBattleDataRemoval"
  | "asksSettingOnly" | "asksStoreOnly" | "asksToBeTold";

describe("readers moved out of the judge files keep their words", () => {
  const rows: readonly (readonly [TextReader, string, boolean])[] = [
    ["asksChaseNotBattleMusic", "추격할 때 긴박한 음악 넣어 줘", true],
    ["asksChaseNotBattleMusic", "추격 음악이랑 전투 음악 바꿔 줘", false],
    ["asksWorkingShop", "무기점에서 검을 살 수 있게 해 줘", true],
    ["asksWorkingShop", "가게 간판을 달아 줘", false],
    ["asksTimedWhereabouts", "촌장은 밤에는 집 안에 있게 해 줘", true],
    ["asksOpenField", "숲에 늑대를 둬", true],
    ["asksOpenField", "마을 광장 옆 숲에 늑대를 둬", false],
    ["namesRandomEncounters", "숲에서는 랜덤으로 몬스터가 나와", true],
    ["namesRandomEncounters", "숲길에서는 무작위 조우는 없어", false],
    ["asksCure", "독을 치료하는 약초", true],
    ["asksClueForLock", "일기에 적힌 숫자로 금고 비밀번호를 맞추게", true],
    ["asksAfterStep", "동굴에 다녀오면 촌장이 열쇠를 준다", true],
    ["asksShownFlashback", "어릴 적 회상 장면이 나오게", true],
    ["asksActEnd", "1막 끝에서 멈춰", true],
    ["asksLetterbox", "레터박스를 넣어", true],
    ["saysNewGame", "새 게임 만들고 싶어", true],
    ["asksOpening", "오프닝을 바꿔", true],
    ["asksComboSkill", "둘이 같이 쓰는 필살기를 만들어", true],
    ["asksPerDay", "날마다 대사가 달라지게", true],
    ["asksBattleDataRemoval", "주인공 스킬을 전부 지워 줘", true],
    ["asksBattleDataRemoval", "메뉴에서 스킬 탭을 지워 줘", false],
    ["asksSettingOnly", "휴대폰에서 탭하면 걷게 해 줘", true],
    ["asksSettingOnly", "도움말 표지판을 세워 줘", false],
    ["asksStoreOnly", "내 게임 평가에 답글 달아 줘", true],
    ["asksToBeTold", "이 게임 뭐가 부족한지 알려 줘", true],
    ["asksToBeTold", "촌장을 광장으로 옮겨 줘", false],
  ];
  it.each(rows)("%s(«%s») = %s", (reader, task, want) => {
    expect(readers[reader](task)).toBe(want);
  });

  it("asksDataChange reads the kind of data the request points at; weapons and armors share the item words", () => {
    expect(readers.asksDataChange("enemies", "보스는 얼음에 약하게")).toBe(true);
    expect(readers.asksDataChange("weapons", "검 가격을 올려")).toBe(true);
    expect(readers.asksDataChange("armors", "검 가격을 올려")).toBe(true);
    expect(readers.asksDataChange("actors", "촌장 대사를 바꿔")).toBe(false);
    expect(readers.asksDataChange("maps", "주인공 이름을 바꿔")).toBe(false);
  });

  it("requestedFeatureWord returns the matched word, and nothing when the feature is refused", () => {
    expect(readers.requestedFeatureWord("darkness", "어두운 복도를 걷는 게임")).toBe("어두운 복도");
    expect(readers.requestedFeatureWord("darkness", "어둡지 않게 해 줘")).toBeUndefined();
    expect(readers.requestedFeatureWord("chaser", "추격자 없이 조용한 게임")).toBeUndefined();
  });
});

/** 게임 하나로 시작한 프로젝트(청사진의 첫 요청이 게임 하나) — 전투 하나, 회복 길 없음. */
function builtGame(blueprint = true): Project {
  const p = createBlankProject() as Project;
  const map = p.maps[p.startMapId]!;
  map.events.push({
    id: "ev_trial", name: "검술 시험관", x: 3, y: 3,
    pages: [{ ...structuredClone(map.events[0]?.pages?.[0] ?? {}), conditions: [], trigger: { kind: "action" }, commands: [{ kind: "battleProcessing", troopId: "troop_slime", canEscape: false, canLose: false }] }],
  } as never);
  if (blueprint) p.gameBlueprint = normalizeGameBlueprint({
    title: "시험 게임", genre: "판타지 RPG", playerGoal: "샘을 되찾자.", request: "판타지 RPG 게임 하나 만들어 줘.",
    steps: [{ id: "s1", place: "시작", event: "촌장", action: "촌장에게 묻는다", gives: "실마리", needs: [], feeling: "궁금함" }, { id: "s2", place: "시작", event: "샘", action: "샘을 살핀다", gives: "끝", needs: ["실마리"], feeling: "안도" }],
    ending: { name: "끝", how: "샘을 살핀다", feeling: "안도" },
  });
  return p;
}
const request = (task: string, project: Project, readOnly = false) => ({ task, project, ...(readOnly ? { readOnly } : {}) }) as PiAgentRequest;

describe("a turn that carries on a whole-game project is a whole-game turn for the judges", () => {
  const CONTINUE = "계속 해 줘", SMALL = "촌장 대사를 바꿔 줘", WHOLE = "판타지 RPG 게임 하나 만들어 줘.";

  it("screen review is on for «계속» on a whole-game project, off for a small edit there and off for «계속» with no game to carry on", () => {
    expect(vqaEnabled(request(CONTINUE, builtGame()))).toBe(true);
    expect(vqaEnabled(request(WHOLE, builtGame(false)))).toBe(true);
    expect(vqaEnabled(request(SMALL, builtGame()))).toBe(false);
    expect(vqaEnabled(request(CONTINUE, builtGame(false)))).toBe(false);
    expect(vqaEnabled(request(CONTINUE, builtGame(), true))).toBe(false);
  });

  it("combat checks run on the carry-on turn even when this turn did not touch combat", () => {
    const game = builtGame();
    expect(combatLines(game, structuredClone(game), CONTINUE).some((p) => p.startsWith("[출하 차단 no-healing]"))).toBe(true);
    expect(combatLines(game, structuredClone(game), SMALL)).toEqual([]);
    const loose = builtGame(false);
    expect(combatLines(loose, structuredClone(loose), CONTINUE)).toEqual([]);
  });

  it("whole-game content checks (title and HUD choices) run on the carry-on turn, not on a small edit", () => {
    const game = builtGame();
    const carried = gameLines(game, structuredClone(game), CONTINUE);
    const whole = gameLines(game, structuredClone(game), WHOLE);
    expect(carried.length).toBeGreaterThan(0);
    // 이어 하기 턴이 받는 것은 게임 하나 요청이 받는 것 가운데 일부다(요청 글의 낱말로만 켜지는 검사는 빠진다).
    for (const p of carried) expect(whole).toContain(p);
    expect(gameLines(game, structuredClone(game), SMALL)).toEqual([]);
  });
});

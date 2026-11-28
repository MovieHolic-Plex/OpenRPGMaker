import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { endingClosing, normalizeGameBlueprint, type GameBlueprint } from "@/project/gameBlueprint";
import { applyShipDefaults } from "@/ai/v2/story/shipDefaults";
import { fillPartyNames, pickChip, reconcileFieldHud } from "@/ai/v2/story/shipLookDefaults";
import type { GameEvent, Project } from "@/project/types";
import { applyDraftCast, draftCastCounts, BOSS_PROFILE_KEY } from "@/ai/v2/story/draftCast";
import { hudIsStoryTemplate, hudTitleChoiceProblems } from "@/ai/v2/judge/hudTitleChecks";
import { STORY_SETUP_HUD, applyStorySetupDefaults } from "@/ai/v2/genreDefaults";
import { hudOnScreen, resolvedHudWidgets, normalizeFieldHud } from "@/project/fieldHud";
import { runTool } from "@/editor/tools";
import { gameContentProblems } from "@/ai/v2/judge/gameChecks";
import { findingLine } from "@/ai/v2/judge/finding";
import { isolateTimers } from "./mergedTeardown";

describe("aiV2EndingClosing", () => {
  isolateTimers();
  // 2026-11-12 Haiku r1h-mystery · r1h-snow: 엔딩 화면에 청사진의 설계 메모(ending.how — «강수연 아내를 지목하면 … 진실 엔딩. 다른 지목은 미궁»)가
  // 그대로 나오고, 용의자 「이도윤」이 있는 게임의 주인공이 「도윤」이 되어 «도윤은 … 이 여정을 끝까지 걸어냈다» 로 맺었다.
  // 엔딩에서 플레이어가 읽는 글은 ending.closing 이고, how 는 화면에 내지 않는다. 문서 openwiki/assistant-v2.md 「엔딩 맺음 글」.

  const HOW = "강수연 아내를 지목하면 처방전과 유언장을 근거로 자백을 받아 진실 엔딩. 다른 지목은 사건을 미궁에 빠뜨린다.";
  const ACTION = "모은 증거로 범인을 지목한다";
  const CLOSING = ["강수연은 처방전과 유언장 앞에서 끝내 고개를 떨구었다.", "박만석은 서재의 불을 끄고, 이도윤은 말없이 저택을 떠났다."];
  function game(closing?: string[]): Project {
    const project = createBlankProject();
    const place = project.maps[project.startMapId]!.name || project.startMapId;
    const blueprint: GameBlueprint = normalizeGameBlueprint({
      title: "저택의 밤", genre: "추리", playerGoal: "범인을 찾아 지목하자.",
      ending: { name: "진실", how: HOW, feeling: "차갑게 가라앉은 진실", ...(closing ? { closing } : {}) },
      steps: [
        { id: "s1", kind: "talk", who: "박만석 (집사)", place, event: "박만석", action: "집사에게 사건을 듣는다", gives: "의뢰", feeling: "긴장" },
        { id: "s2", kind: "talk", who: "이도윤 (조카)", place, event: "이도윤", action: ACTION, needs: "의뢰", gives: "엔딩", feeling: "결단" },
      ],
    });
    project.gameBlueprint = blueprint;
    (project as unknown as { endings: unknown[] }).endings = [{ id: "ending_truth", name: "진실", conditions: [], epilogue: [], presentation: {} }];
    return project;
  }
  const shown = (project: Project): string[] => ((project.endings ?? []) as unknown as { epilogue?: { text?: string }[] }[]).flatMap((e) => (e.epilogue ?? []).map((b) => String(b.text ?? "")).filter(Boolean));
  describe("청사진 ending.closing — 엔딩 화면에서 플레이어가 읽는 글", () => {
    it("closing 을 남기고(빈 줄은 버린다) 옛 청사진(closing 없음)도 그대로 읽는다", () => {
      expect(endingClosing(game([...CLOSING, "  "]).gameBlueprint!)).toEqual(CLOSING);
      const legacy = game().gameBlueprint!;
      expect(legacy.ending.closing).toBeUndefined();
      expect(endingClosing(legacy)).toEqual([]);
    });
  });
  describe("기본 맺음 글은 설계 메모를 화면에 내지 않는다", () => {
    it("closing 이 없으면 how · 마지막 단계의 action 을 맺음 글로 쓰지 않는다", () => {
      const project = game();
      applyShipDefaults(project);
      const text = shown(project).join("\n");
      expect(text).not.toContain("지목하면");
      expect(text).not.toContain("진실 엔딩");
      expect(text).not.toContain(ACTION);
    });

    it("closing 이 있으면 그 줄이 맺음 글의 앞에 선다", () => {
      const project = game(CLOSING);
      applyShipDefaults(project);
      const lines = shown(project);
      expect(lines.slice(0, 2)).toEqual(CLOSING);
      expect(lines.join("\n")).not.toContain("지목하면");
    });
  });
  describe("주인공 기본 이름은 게임 속 인물 이름에 든 이름을 피한다", () => {
    it("「이도윤」 · 「김하람」 … 이 있는 게임의 주인공은 그 이름들이 아니다", () => {
      const project = game();
      const map = project.maps[project.startMapId]!;
      for (const [i, name] of ["이도윤", "김하람", "박이안", "최시온", "정태오"].entries()) map.events.push({ id: `ev_extra_${i}`, name, x: 8 + i, y: 5, pages: [{ conditions: [], commands: [] }] } as unknown as GameEvent);
      fillPartyNames(project, "");
      const hero = project.database.actors.find((a) => a.id === project.system.startActorIds?.[0])!.name;
      expect(hero).toBe("라온");
    });
  });
  // 2026-11-24 ideal-flow-draft: 첫 판이 맵 3장만 짓고 세계관·동료·직업은 비었다. 청사진 cast·world·items 칸을 끝맺음 draft-cast 가 자료집으로 짓는다.
  function castGame(battles = true): Project {
    const project = game();
    project.gameBlueprint = normalizeGameBlueprint({
      ...project.gameBlueprint, ...(battles ? {} : { battles: false }),
      cast: { hero: { name: "아젤", role: "몰락한 마왕", skill: "마왕의 위압" }, companions: [{ name: "리나", role: "견습 사제", bio: "변경의 사제." }, { name: "볼크", role: "퇴역 용병" }, { name: "리나" }, { role: "이름 없음" }], boss: { name: "용사 카일" } },
      world: { name: "아르센 변경", premise: "마법이 쇠한 인간 왕국의 변경.", rules: ["마력은 달이 뜰 때만 돌아온다"], tones: ["comic", "없는톤"] },
      items: ["달빛 결정", "변경 빵", "부러진 마왕의 뿔"],
    });
    return project;
  }
  describe("청사진 인물·세계 칸 → 첫 판 초안 데이터(draft-cast)", () => {
    it("cast 는 이름 없는·겹치는 동료를 버리고, world 는 목록에 없는 톤을 버린다", () => {
      const bp = castGame().gameBlueprint!;
      expect(bp.cast?.companions?.map((p) => p.name)).toEqual(["리나", "볼크"]);
      expect(bp.world?.tones).toEqual(["comic"]);
      expect(bp.items).toHaveLength(3);
    });

    it("주인공 이름·직업, 동료 둘(파티·직업·기술), 세계관, 물건 셋, 보스 적을 짓고 다시 돌면 아무것도 바꾸지 않는다", () => {
      const project = castGame();
      const before = draftCastCounts(project);
      expect(applyDraftCast(project).length).toBeGreaterThan(0);
      const party = (project.system.startActorIds ?? []).map((id) => project.database.actors.find((a) => a.id === id)!);
      expect(party.map((a) => a.name)).toEqual(["아젤", "리나", "볼크"]);
      expect(new Set(party.map((a) => a.faceResourceId)).size).toBe(3);
      expect(party.map((a) => project.database.classes.find((c) => c.id === a.classId)?.name)).toEqual(["몰락한 마왕", "견습 사제", "퇴역 용병"]);
      expect(project.database.skills.some((s) => s.name === "마왕의 위압" && party[0]!.learnedSkills.some((l) => l.skillId === s.id))).toBe(true);
      expect(project.worldCanon?.name).toBe("아르센 변경");
      expect(project.characters?.[party[1]!.id]?.note).toBe("변경의 사제.");
      expect(project.characters?.[BOSS_PROFILE_KEY]?.displayName).toBe("용사 카일");
      const after = draftCastCounts(project);
      expect(after.items - before.items).toBe(3);
      expect(after.classes).toBeGreaterThanOrEqual(3);
      expect(after.skills - before.skills).toBe(3);
      expect(project.database.enemies.some((e) => e.name === "용사 카일")).toBe(true);
      expect(applyDraftCast(project)).toEqual([]);
    });

    it("싸움 없는 게임은 동료를 파티에 세우지 않고 적도 짓지 않지만 인물 소개는 남긴다", () => {
      const project = castGame(false);
      applyDraftCast(project);
      expect(project.system.startActorIds).toHaveLength(1);
      expect(Object.values(project.characters ?? {}).map((p) => p.displayName)).toEqual(expect.arrayContaining(["리나", "볼크"]));
      expect(project.database.enemies.some((e) => e.name === "용사 카일")).toBe(false);
    });

    it("이미 시작 파티에 선 동료가 있으면 그 위에 동료를 더 세우지 않는다", () => {
      const project = castGame();
      const hero = project.database.actors.find((a) => a.id === project.system.startActorIds?.[0])!;
      const mate = { ...structuredClone(hero), id: "actor_seira", name: "세이라", nickname: "견습 마법사" };
      project.database.actors.push(mate);
      project.system.startActorIds = [hero.id, mate.id];
      applyDraftCast(project);
      const party = (project.system.startActorIds ?? []).map((id) => project.database.actors.find((a) => a.id === id)!.name);
      expect(party).toEqual(["아젤", "세이라", "리나", "볼크"]);
      expect(project.characters?.actor_seira?.displayName).toBe("세이라");
    });

    it("cast 가 없으면 청사진 대화 상대로 동료 소개를 채우고, 그 사람들은 시작 파티에 넣지 않는다", () => {
      const project = game();
      applyDraftCast(project);
      expect(project.system.startActorIds).toHaveLength(1);
      const names = Object.values(project.characters ?? {}).map((p) => p.displayName);
      expect(names).toEqual(expect.arrayContaining(["박만석", "이도윤"]));
      expect(names).not.toContain("리안");
    });
  });
  describe("칩 고르기는 영어 looks·아주머니도 여성으로 읽는다", () => {
    it("«young woman» · «옆집 아주머니» 에 남성 칩을 주지 않는다", () => {
      for (const text of ["리나 young woman 견습 사제", "옆집 아주머니"]) expect(pickChip(text, new Set(), undefined)?.label ?? "").not.toMatch(/남성|청년|소년/u);
    });
  });
});

describe("aiV2HudTitleChecks", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const hudTitleLines = (...args: Parameters<typeof hudTitleChoiceProblems>): string[] => hudTitleChoiceProblems(...args).map(findingLine);
  const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);
  const WHOLE = "용사가 마왕을 잡으러 가는 짧은 RPG 만들어줘";
  const hud = (p: Project) => hudTitleLines(p).filter((m) => m.startsWith("[게임 검사 HUD 선택]"));
  const title = (p: Project) => hudTitleLines(p).filter((m) => m.startsWith("[게임 검사 타이틀 모양]"));
  describe("v2 HUD / title choice (fs-use-tools HUD; 2026-11-11 the HUD is derived, not asked)", () => {
    it("a health-off HUD that shows only the clock is not flagged as «always shows health» (2026-11-12 — the clock widget's default source is hp)", () => {
      const before = createBlankProject() as Project;
      const after = createBlankProject() as Project;
      after.system.fieldHud = { ...STORY_SETUP_HUD };
      const lines = gameLines(before, after, "숲속에 작은 마을 하나 깔아 줘");
      expect(lines.filter((m) => m.startsWith("[게임 검사 HUD]"))).toEqual([]);
      // 체력 게이지를 정말 켠 HUD 는 여전히 걸린다(체력이 줄 일이 없는 게임).
      const shown = createBlankProject() as Project;
      shown.system.fieldHud = { ...STORY_SETUP_HUD, vitals: true };
      expect(gameLines(before, shown, "숲속에 작은 마을 하나 깔아 줘").some((m) => m.startsWith("[게임 검사 HUD]"))).toBe(true);
    });

    it("no longer asks the model to pick a HUD — the template is recognised but is not a gate problem", () => {
      const p = createBlankProject() as Project;
      p.system.fieldHud = { ...STORY_SETUP_HUD } as never;
      expect(hudIsStoryTemplate(p)).toBe(true);
      expect(hud(p)).toEqual([]);
      const before = createBlankProject() as Project;
      expect(gameLines(before, p, WHOLE).some((m) => m.startsWith("[게임 검사 HUD 선택]"))).toBe(false);
    });

    it("matches what applyStorySetupDefaults really writes (even after uiLook stamps font/panel shell)", () => {
      const p = createBlankProject() as Project;
      p.system.fieldHud = undefined as never;
      applyStorySetupDefaults(p, "이야기 게임 만들어줘", true);
      expect(p.system.fieldHud).toBeDefined();
      expect(hudIsStoryTemplate(p)).toBe(true);
      p.system.fieldHud = { ...p.system.fieldHud!, font: "round", panel: "dark" };
      expect(hudIsStoryTemplate(p)).toBe(true);
    });

    it("honors blueprint.hud and picks context-appropriate HUDs (action -> adventure, monster/multi-map -> collector, timeSystem -> clock)", () => {
      const actionGame = createBlankProject() as Project;
      actionGame.system.actionCombat = { ...(actionGame.system.actionCombat ?? {}), enabled: true } as never;
      actionGame.system.fieldHud = undefined;
      reconcileFieldHud(actionGame);
      expect(actionGame.system.fieldHud?.theme).toBe("adventure");

      const multiMap = createBlankProject() as Project;
      multiMap.maps.map_town = { ...structuredClone(multiMap.maps[multiMap.startMapId]!), id: "map_town", name: "항구 마을" };
      multiMap.gameBlueprint = normalizeGameBlueprint({
        title: "항구 모험", genre: "판타지 RPG", playerGoal: "수호 종을 찾자.",
        steps: [
          { id: "s1", place: "항구 마을", event: "촌장", action: "대화", gives: "단서", feeling: "기대" },
          { id: "s2", place: "항구 마을", event: "신전", action: "조사", gives: "엔딩", feeling: "성취" },
        ],
        ending: { name: "귀환", how: "종을 울린다", feeling: "안도" },
      });
      multiMap.system.fieldHud = undefined;
      reconcileFieldHud(multiMap);
      expect(multiMap.system.fieldHud?.theme).toBe("collector");
      expect(multiMap.system.fieldHud?.objective).toBe(true);

      const bpChoice = createBlankProject() as Project;
      bpChoice.gameBlueprint = normalizeGameBlueprint({
        title: "수집 여행", genre: "모험", hud: "collector", playerGoal: "여행하자.",
        steps: [
          { id: "s1", place: "마을", event: "npc", action: "대화", gives: "a", feeling: "f" },
          { id: "s2", place: "마을", event: "npc2", action: "대화", gives: "b", feeling: "f" },
        ],
        ending: { name: "끝", how: "끝", feeling: "안도" },
      });
      bpChoice.system.fieldHud = undefined;
      reconcileFieldHud(bpChoice);
      expect(bpChoice.system.fieldHud?.theme).toBe("collector");
    });

    it("set_field_hud keeps objective on by default and supports font/panel shell options", () => {
      const ctx = { project: createBlankProject() as Project };
      const res = runTool(ctx, "set_field_hud", { theme: "collector", font: "pixel", panel: "paper" });
      expect(res.ok, res.summary).toBe(true);
      expect(ctx.project.system.fieldHud?.objective).toBe(true);
      expect(ctx.project.system.fieldHud?.font).toBe("pixel");
      expect(ctx.project.system.fieldHud?.panel).toBe("paper");
    });

    it("the finish step picks for a game still on the template: no health loss → nothing but the objective line", () => {
      const p = createBlankProject() as Project;
      for (const map of Object.values(p.maps)) { map.encounterRate = 0; map.events = []; }
      (p.database as { commonEvents?: unknown[] }).commonEvents = [];
      p.system.fieldHud = { ...STORY_SETUP_HUD };
      expect(reconcileFieldHud(p).length).toBe(1);
      expect(resolvedHudWidgets(p.system.fieldHud!)).toEqual([]);
      expect(p.system.fieldHud!.objective).toBe(true);
      expect(reconcileFieldHud(p)).toEqual([]);
    });

    it("vitals:false hides every body gauge, not only health (the lone «마력» bar)", () => {
      const sources = (vitals: boolean) => resolvedHudWidgets(normalizeFieldHud({ theme: "adventure", vitals, objective: true })).filter((w) => w.kind === "gauge").map((w) => w.source);
      expect(sources(true)).toEqual(["hp", "mp", "stamina"]);
      expect(sources(false)).toEqual([]);
    });

    it("set_field_hud leaves out gauges the game never changes and says what is on screen; they return once the game uses them", () => {
      const ctx = { project: createBlankProject() as Project };
      for (const map of Object.values(ctx.project.maps)) { map.encounterRate = 0; map.events = []; }
      (ctx.project.database as { commonEvents?: unknown[] }).commonEvents = [];
      const result = runTool(ctx, "set_field_hud", { theme: "adventure" });
      expect(result.ok, result.summary).toBe(true);
      const data = result.data as { onScreen: string[]; unused: string[] };
      expect(data.unused.map((u) => u.split(" ")[0]).sort()).toEqual(["hp", "mp", "stamina"]);
      expect(data.onScreen.some((line) => line.includes("gauge"))).toBe(false);
      expect(hudOnScreen(ctx.project.system.fieldHud!).some((line) => line.includes("gauge"))).toBe(false);
      // 전투와 마력 드는 기술이 생기면 끝맺음이 체력·마력을 되돌린다(스태미나는 액션 전투가 아니라 그대로 빠진다).
      const map = Object.values(ctx.project.maps)[0]!;
      map.events = [{ id: "ev_fight", name: "적", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{ id: "p0", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "battleProcessing" }] }] }] as never;
      const skills = (ctx.project.database as unknown as { skills: { mpCost?: unknown }[] }).skills;
      if (!skills.length) skills.push({} as never);
      skills[0]!.mpCost = { flat: 5, percentMax: 0 };
      ctx.project.system.actionCombat = { ...(ctx.project.system.actionCombat ?? {}), enabled: true } as never;
      expect(reconcileFieldHud(ctx.project).length).toBe(1);
      expect(resolvedHudWidgets(ctx.project.system.fieldHud!).filter((w) => w.kind === "gauge").map((w) => w.source)).toEqual(["hp", "mp", "stamina"]);
      expect(reconcileFieldHud(ctx.project)).toEqual([]);
    });

    it("an action-combat HUD (adventure) picked for a turn-based game is replaced by the derived one", () => {
      const p = createBlankProject() as Project;
      const map = Object.values(p.maps)[0]!;
      map.events = [{ id: "ev_fight", name: "적", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{ id: "p0", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "battleProcessing" }] }] }] as never;
      p.system.fieldHud = normalizeFieldHud({ theme: "adventure", vitals: true, objective: true });
      expect(reconcileFieldHud(p).length).toBe(1);
      // 턴제 전투만 있는 게임: 체력은 전투 화면과 메뉴에 있다 — 필드에는 목표 줄만(2026-11-13).
      expect(resolvedHudWidgets(p.system.fieldHud!)).toEqual([]);
      expect(p.system.fieldHud!.objective).toBe(true);
      expect(reconcileFieldHud(p)).toEqual([]);
    });

    it("an authored widget list (petal life, affection gauge) is left alone", () => {
      const p = createBlankProject() as Project;
      p.system.fieldHud = normalizeFieldHud({ theme: "horror", vitals: false, objective: true, widgets: [{ id: "life", source: "variable", variableId: "v1", shape: "petals", label: "" }] });
      const before = JSON.stringify(p.system.fieldHud);
      expect(reconcileFieldHud(p)).toEqual([]);
      expect(JSON.stringify(p.system.fieldHud)).toBe(before);
    });

    it("flags a title screen with neither lettering style nor menu style, clears once either is chosen", () => {
      const p = createBlankProject() as Project;
      p.system.titleScreen = { ...(p.system.titleScreen as object), logoStyle: undefined, menuStyle: undefined } as never;
      expect(title(p)).toHaveLength(1);
      p.system.titleScreen = { ...(p.system.titleScreen as object), logoStyle: "stone" } as never;
      expect(title(p)).toEqual([]);
      p.system.titleScreen = { ...(p.system.titleScreen as object), logoStyle: undefined, menuStyle: "plain" } as never;
      expect(title(p)).toEqual([]);
    });

  });
});

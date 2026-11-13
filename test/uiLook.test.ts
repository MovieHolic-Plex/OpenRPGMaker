import { describe, expect, it } from "vitest";
import { applyLookDefaults } from "@/ai/v2/story/shipDefaults";
import { BLUEPRINT_CARD, parseBlueprintArgs, WRITE_BLUEPRINT_SCHEMA } from "@/ai/v2/story/blueprint";
import { BATTLE_LOOK_PRESET_IDS, BATTLE_LOOK_PRESETS, battleLookFillsBand, resolveBattleLook } from "@/project/battleLook";
import { DEFAULT_RUNTIME_WINDOW_SKIN_ID, normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { DIALOGUE_STYLE_IDS } from "@/project/dialogueStyles";
import { normalizeFieldHud, resolvedHudWidgets } from "@/project/fieldHud";
import { listMenuSkinIds } from "@/player/menuSkins/registry";
import { listStatusMenuCommandIds, listStatusMenuGroupCommandIds, listStatusMenuRailIds } from "@/player/playerStatusMenuModel";
import { startSession } from "@/project/session";
import type { Project } from "@/project/types";
import { applyUiLook, FALLBACK_UI_LOOK_ID, pickUiLook, UI_LOOK_ERA_BY_FAMILY, UI_LOOK_IDS, UI_LOOKS, uiLookBattle, uiLookById, uiLookCandidates, uiLookFacts, uiLookHint, type UiLookCombat, type UiLookEra } from "@/project/uiLook";

const fight = (p: Project): void => {
  p.maps[p.startMapId!]!.events.push({ id: "ev_slime", name: "슬라임", x: 3, y: 3, pages: [{ conditions: [], trigger: "action", commands: [{ kind: "battleProcessing", troopId: p.database.troops[0]?.id ?? "troop_1" }] }] } as never);
};
const calm = (): Project => {
  const p = createBlankProject() as Project;
  for (const map of Object.values(p.maps)) { map.encounterRate = 0; map.events = []; }
  return p;
};

describe("UI 모습 목록 — 있는 스타일만으로 짠 한 벌", () => {
  it("모든 세트가 실제로 있는 대사창·메뉴·전투 창 id 를 쓴다(새 스타일 없음)", () => {
    expect(new Set(UI_LOOK_IDS).size).toBe(UI_LOOK_IDS.length);
    for (const look of UI_LOOKS) {
      expect(DIALOGUE_STYLE_IDS, look.id).toContain(look.dialogue);
      expect(listMenuSkinIds(), look.id).toContain(look.menu);
      expect(BATTLE_LOOK_PRESET_IDS, look.id).toContain(look.battle);
      expect(look.fit.split(/\s+/u).length, look.id).toBeLessThanOrEqual(8);
      expect(look.fit, look.id).toMatch(/^[\x20-\x7e]+$/u); // 모델에게 가는 글은 영어
    }
    expect(uiLookById(FALLBACK_UI_LOOK_ID)).toBeDefined();
  });

  it("모델에게 가는 글은 300자 안 — 카드에는 없고, 스키마 한 칸 + 도구 답의 후보 한 줄(그 세계의 세트 셋까지)", () => {
    expect(BLUEPRINT_CARD).not.toMatch(/look/iu);
    const { look, ...rest } = WRITE_BLUEPRINT_SCHEMA.properties;
    const schemaDelta = JSON.stringify(WRITE_BLUEPRINT_SCHEMA).length - JSON.stringify({ ...WRITE_BLUEPRINT_SCHEMA, properties: rest }).length;
    expect(look.description.length).toBeLessThanOrEqual(60);
    // 어느 세계·전투 방식에서도 스키마 증분 + 답 한 줄이 300자 안이다.
    const eras = [...new Set(Object.values(UI_LOOK_ERA_BY_FAMILY))];
    let longest = 0;
    // 빈 프로젝트는 짓는 데 오래 걸린다 — 싸우는 판/안 싸우는 판 둘만 짓고 칩셋 계열만 바꿔 가며 읽는다.
    const projects = [false, true].map((withFight) => {
      const p = calm();
      p.tilesets = { ...p.tilesets, probe: { ...Object.values(p.tilesets)[0]!, id: "probe" } };
      if (withFight) fight(p);
      return { withFight, p };
    });
    for (const [family] of Object.entries(UI_LOOK_ERA_BY_FAMILY)) for (const { withFight, p } of projects) for (const key of ["k1", "k2", "k3", "k4"]) {
      (p.tilesets.probe as { family?: string }).family = family;
      const hint = uiLookHint(p, key, "probe");
      longest = Math.max(longest, hint.length);
      expect(hint.split(" = ").length - 1, `${family} ${withFight}`).toBeLessThanOrEqual(3);
      for (const id of hint.match(/(?<=[:·] )[a-z0-9-]+(?= = )/gu) ?? []) expect(uiLookById(id), id).toBeDefined();
    }
    expect(eras.length).toBeGreaterThan(0);
    expect(schemaDelta + longest, `schema ${schemaDelta} + hint ${longest}`).toBeLessThanOrEqual(300);
  });

  it("시대·전투 방식마다 고를 것이 있다 — 맞는 세트가 없는 자리(그림 공백)는 무난한 기본", () => {
    const eras = [...new Set(Object.values(UI_LOOK_ERA_BY_FAMILY))] as UiLookEra[];
    const gaps: string[] = [];
    for (const era of eras) for (const combat of ["none", "turn", "action"] as UiLookCombat[]) {
      const pool = uiLookCandidates({ era, combat, talky: combat === "none" }).map((l) => l.id);
      expect(pool.length, `${era} ${combat}`).toBeGreaterThanOrEqual(1);
      if (pool.length === 1 && pool[0] === FALLBACK_UI_LOOK_ID && era !== "future" && era !== "modern") gaps.push(`${era} ${combat}`);
    }
    // 흑창 세트 셋을 뺀 뒤 세트가 없는 자리 — 위키의 그림 공백 표와 같아야 한다.
    expect(gaps).toEqual(["primeval action"]);
    // 시대를 모르는 게임(업로드 칩셋)이 싸우면 무난한 기본.
    expect(uiLookCandidates({ combat: "turn", talky: false }).map((l) => l.id)).toEqual([FALLBACK_UI_LOOK_ID]);
  });

  it("한 벌은 한 가족이다 — 밝은 대사창의 세트는 밝은 메뉴·밝은 전투 창, 어두운 대사창의 세트는 어두운 메뉴", () => {
    const LIGHT_DIALOGUE = ["wood", "joseon", "handheld", "white-card", "cream"];
    const LIGHT_MENU = ["journal", "field-list"];
    for (const look of UI_LOOKS) {
      const light = LIGHT_DIALOGUE.includes(look.dialogue);
      expect(LIGHT_MENU.includes(look.menu), look.id).toBe(light);
      expect((look.battleWindow ?? look.battle) === "parch", look.id).toBe(light);
      expect(look.hud.panel, look.id).toBe(light ? "paper" : "dark");
    }
    // 흑창 대사창(retro-black · double-line · skew · mono-heavy)은 검은 메뉴 스킨이 없어 세트로 짜지 않았다.
    for (const look of UI_LOOKS) expect(["retro-black", "double-line", "skew", "mono-heavy"], look.id).not.toContain(look.dialogue);
  });
});

describe("세트는 화면을 비우지도, 쓸 데 없는 명령을 싣지도 않는다 (확인 빌드 r3 의 두 결함)", () => {
  it("전투 배치 — 어느 세트든 아래 띠를 창이 다 덮는다(전장은 창 위까지 · 명령 창은 왼쪽 아래 · 파티는 그 옆 줄 목록)", () => {
    // 이 계약이 왜 필요한가: 프리셋 가운데 여섯(teal · gold · icons · soft · pop · cinema)은 전장을 화면 끝까지 쓰는 배치라 그대로 입히면 아래 1/3 이 빈다.
    expect(BATTLE_LOOK_PRESET_IDS.filter((id) => !battleLookFillsBand(BATTLE_LOOK_PRESETS[id].axes)).length).toBeGreaterThan(0);
    for (const look of UI_LOOKS) {
      expect(battleLookFillsBand(resolveBattleLook(uiLookBattle(look))), look.id).toBe(true);
      // 테 없는 창(bare)은 판이 없다 — 맵을 그대로 배경으로 쓰는 전투에서 안내 글·승리 창이 타일 위에 맨 글자로 뜬다.
      expect(resolveBattleLook(uiLookBattle(look)).window, look.id).not.toBe("bare");
      // 입힌 뒤의 저장값으로도 — 끝맺음이 먼저 켠 적 이름표·체력 막대가 있어도, 다른 세트에서 옮겨 와도.
      for (const from of [undefined, "gilded", "haunted"]) {
        const p = calm();
        p.system.battleLook = { enemyHp: true, enemyNames: true };
        if (from) applyUiLook(p, from);
        applyUiLook(p, look.id);
        const resolved = resolveBattleLook(p.system.battleLook);
        expect(battleLookFillsBand(resolved), `${from ?? "-"} → ${look.id}`).toBe(true);
        expect(resolved.preset, look.id).toBe(look.battle);
        expect(resolved.enemyHp && resolved.enemyNames, look.id).toBe(true);
      }
    }
  });

  it("ESC 메뉴 — 어느 세트의 메뉴든 이 게임에 쓸 데 없는 명령(열 바꾸기 · 진형 · 몬스터)을 싣지 않는다", () => {
    const ABSENT = ["row", "formation", "monsters"];
    for (const look of UI_LOOKS) {
      // 주인공 혼자인 턴제 게임.
      const solo = calm();
      fight(solo);
      applyUiLook(solo, look.id, { force: true });
      const session = startSession(solo);
      expect(session.partyActorIds, look.id).toHaveLength(1);
      const shown = [...listStatusMenuRailIds(solo, session), ...listStatusMenuCommandIds(solo, session), ...(listStatusMenuRailIds(solo, session).includes("party-menu") ? listStatusMenuGroupCommandIds("party-menu", solo, session) : [])];
      for (const id of ABSENT) expect(shown, `${look.id} solo ${id}`).not.toContain(id);
      expect(shown, look.id).toContain("items");
      // 동료 셋 — 열·진형은 쓸 데가 생기고, 몬스터는 여전히 없다.
      session.partyActorIds = ["actor_hero", "actor_mage", "actor_cleric"];
      const party = listStatusMenuCommandIds(solo, session);
      expect(party, look.id).toEqual(expect.arrayContaining(["status", "row", "formation"]));
      expect(party, look.id).not.toContain("monsters");
    }
  });
});

describe("고르기 — 청사진이 먼저, 없으면 게임의 사실 + 열쇠", () => {
  it("청사진의 look 이 이긴다; 목록에 없는 id 는 읽을 때 버려진다", () => {
    const p = calm();
    fight(p);
    const parsed = parseBlueprintArgs({ title: "t", genre: "g", look: "hanji", playerGoal: "goal", steps: [{ id: "s1", place: "a", event: "b", action: "c", gives: "d", feeling: "e" }, { id: "s2", place: "a", event: "b2", action: "c", gives: "d", feeling: "e" }], ending: { name: "n", how: "h", feeling: "f" } }, "");
    expect("blueprint" in parsed && parsed.blueprint.look).toBe("hanji");
    p.gameBlueprint = (parsed as { blueprint: NonNullable<Project["gameBlueprint"]> }).blueprint;
    expect(pickUiLook(p, "k1").look.id).toBe("hanji");
    const bad = parseBlueprintArgs({ title: "t", genre: "g", look: "nope", playerGoal: "goal", steps: [{ id: "s1", place: "a", event: "b", action: "c", gives: "d", feeling: "e" }, { id: "s2", place: "a", event: "b2", action: "c", gives: "d", feeling: "e" }], ending: { name: "n", how: "h", feeling: "f" } }, "");
    expect("blueprint" in bad && bad.blueprint.look).toBeUndefined();
  });

  it("같은 게임·같은 열쇠 → 같은 모습, 열쇠가 다르면 후보 안에서 갈린다", () => {
    const p = calm();
    fight(p);
    const facts = uiLookFacts(p);
    expect(facts.combat).toBe("turn");
    const pool = uiLookCandidates(facts).map((l) => l.id);
    const picks = Array.from({ length: 24 }, (_, i) => pickUiLook(p, `game-${i}`).look.id);
    expect(pickUiLook(p, "game-3").look.id).toBe(picks[3]);
    for (const id of picks) expect(pool).toContain(id);
    expect(new Set(picks).size).toBeGreaterThanOrEqual(Math.min(3, pool.length));
  });

  it("요청 글은 읽지 않는다 — 같은 게임이면 무슨 요청이든 같은 모습", () => {
    const a = calm(), b = calm();
    fight(a); fight(b);
    applyLookDefaults(a, "좀비 공포 게임 만들어줘", "same-key");
    applyLookDefaults(b, "용사가 마왕을 잡는 판타지 RPG", "same-key");
    expect(a.system.uiLook).toBeDefined();
    expect(a.system.uiLook).toBe(b.system.uiLook);
    expect(a.system.menuUiStyle).toBe(b.system.menuUiStyle);
  });

  it("직접 고른 축은 그대로 두고, 그 축과 겹치는 세트로 나머지를 채운다", () => {
    const p = calm();
    fight(p);
    p.system.dialogueStyle = "wood";
    applyLookDefaults(p, "", "any-key");
    expect(p.system.dialogueStyle).toBe("wood");
    expect(p.system.uiLook).toBe("storybook");
    expect(p.system.menuUiStyle).toBe("journal");
    // 이 게임의 시대 후보에 없는 대사창을 골랐다 — 그 대사창이 든 세트가 나머지를 채운다(고른 메뉴는 그대로).
    const q = calm();
    fight(q);
    q.system.dialogueStyle = "terminal";
    q.system.menuUiStyle = "hub";
    applyLookDefaults(q, "", "any-key");
    expect(q.system.dialogueStyle).toBe("terminal");
    expect(q.system.menuUiStyle).toBe("hub");
    expect(q.system.uiLook).toBe("terminal");
    expect(q.system.battleLook?.preset).toBe("veil");
    // 메뉴만 고른 게임은 시대 후보 밖으로 나가지 않는다 — 버들항 세계가 SF 세트를 받지 않는다.
    const m = calm();
    fight(m);
    m.system.menuUiStyle = "workbench";
    applyLookDefaults(m, "", "any-key");
    expect(uiLookCandidates(uiLookFacts(m)).map((l) => l.id)).toContain(m.system.uiLook);
    // 어느 세트에도 없는 대사창(mono-heavy)을 고르면 시대 후보에서 고르고 대사창은 그대로.
    const odd = calm();
    fight(odd);
    odd.system.dialogueStyle = "mono-heavy";
    applyLookDefaults(odd, "", "any-key");
    expect(odd.system.dialogueStyle).toBe("mono-heavy");
    expect(uiLookCandidates(uiLookFacts(odd)).map((l) => l.id)).toContain(odd.system.uiLook);
  });
});

describe("입히기", () => {
  it("끝맺음을 두 번 돌아도 같다(멱등) · 저장 정규화를 거쳐도 다시 채우지 않는다", () => {
    const p = calm();
    fight(p);
    expect(applyLookDefaults(p, "", "key-a").some((line) => line.startsWith("UI 모습 → "))).toBe(true);
    const first = JSON.stringify(p.system);
    expect(applyLookDefaults(p, "", "key-a")).toEqual([]);
    expect(JSON.stringify(p.system)).toBe(first);
    p.system = { ...p.system, ...normalizeSystemRecords(p.system) };
    expect(applyLookDefaults(p, "", "other-key").filter((line) => line.startsWith("UI 모습"))).toEqual([]);
  });

  it("청사진의 look 을 바꾸면 전에 입힌 축만 새 세트로 옮긴다 — 그 사이 직접 바꾼 축은 그대로", () => {
    const p = calm();
    applyUiLook(p, "kingdom");
    expect(p.system.dialogueStyle).toBe("retro-blue");
    p.system.menuUiStyle = "hub"; // 저자가 메뉴를 직접 바꿨다
    const notes = applyUiLook(p, "gilded");
    expect(p.system.dialogueStyle).toBe("gold");
    expect(p.system.menuUiStyle).toBe("hub");
    expect(p.system.battleLook?.preset).toBe("gold");
    // 적 이름표·체력 막대(끝맺음이 켠 것)는 세트를 바꿔도 남는다 — 그 두 칸은 «전투 창을 직접 골랐다» 로 치지도 않는다.
    const plates = calm();
    plates.system.battleLook = { enemyHp: true, enemyNames: true };
    applyUiLook(plates, "hanji");
    expect(plates.system.battleLook).toEqual({ enemyHp: true, enemyNames: true, preset: "ink", window: "parch" });
    applyUiLook(plates, "kingdom");
    expect(plates.system.battleLook).toEqual({ enemyHp: true, enemyNames: true });
    // 프리셋 기본으로 켜져 있어 저장에 없던 이름표(금테)도 지킨다 — 금테 세트를 입히고 끝맺음이 체력 막대만 적어 둔 저장값에서 다른 세트로 옮길 때(확인 빌드 r3b).
    const implied = calm();
    applyUiLook(implied, "gilded");
    implied.system.battleLook = { ...implied.system.battleLook, enemyHp: true };
    expect(implied.system.battleLook).not.toHaveProperty("enemyNames");
    applyUiLook(implied, "rm2003");
    expect(resolveBattleLook(implied.system.battleLook)).toMatchObject({ preset: "teal", enemyNames: true, enemyHp: true });
    // 아무도 켜지 않은 칸은 적지 않는다 — 끝맺음이 «아직 안 정했다» 로 읽고 켤 수 있게.
    const bare = calm();
    applyUiLook(bare, "rm2003");
    expect(bare.system.battleLook).not.toHaveProperty("enemyNames");
    expect(bare.system.battleLook).not.toHaveProperty("enemyHp");
    expect(p.system.titleScreen?.logoStyle).toBe("gold");
    expect(p.system.uiLook).toBe("gilded");
    expect(notes.some((note) => note.startsWith("메뉴 "))).toBe(false);
  });

  it("HUD 는 껍질(글꼴·판)만 — 프리셋 칸의 구성·크기는 그대로, 직접 짠 칸은 건드리지 않는다", () => {
    const p = calm();
    p.system.fieldHud = normalizeFieldHud({ theme: "party", objective: true });
    const before = resolvedHudWidgets(p.system.fieldHud).map((w) => `${w.id} ${w.width}x${w.height} ${w.x},${w.y}`);
    applyUiLook(p, "storybook");
    expect(p.system.fieldHud.font).toBe("pixel");
    expect(p.system.fieldHud.panel).toBe("paper");
    const after = resolvedHudWidgets(normalizeFieldHud(p.system.fieldHud));
    expect(after.map((w) => `${w.id} ${w.width}x${w.height} ${w.x},${w.y}`)).toEqual(before);
    expect(after.filter((w) => w.panel !== "none").every((w) => w.panel === "paper")).toBe(true);
    const own = calm();
    own.system.fieldHud = normalizeFieldHud({ theme: "horror", vitals: false, objective: true, widgets: [{ id: "life", source: "variable", variableId: "v1", shape: "petals", label: "", panel: "dark" }] });
    applyUiLook(own, "storybook");
    expect(resolvedHudWidgets(own.system.fieldHud!)[0]!.panel).toBe("dark");
  });

  it("편집기 기본 윈도스킨일 때만 창 그림을 바꾼다", () => {
    expect(DEFAULT_RUNTIME_WINDOW_SKIN_ID).toBe("windowskin-warm");
    const p = calm();
    p.system.systemResourceId = "my-skin";
    applyUiLook(p, "kingdom");
    expect(p.system.systemResourceId).toBe("my-skin");
    const q = calm();
    applyUiLook(q, "kingdom");
    expect(q.system.systemResourceId).toBe("windowskin-default");
  });
});
